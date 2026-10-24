/**
 * Importação de dados para a base de dados — idempotente e sem eliminações.
 *
 * Fontes: (1) o cadastro e os dados actuais definidos no código do frontend (src/data/*);
 *         (2) uma exportação do localStorage de um navegador (ferramenta /painel/importacao).
 *
 * Para cada registo: novo → inserido; idêntico → ignorado; diferente do existente → CONFLITO
 * (só é substituído se for explicitamente indicado). Registos com referências inexistentes ou que
 * violariam a exclusividade de reservas são rejeitados e listados no relatório.
 */
import { COLLECTIONS, BLOCKING_RESERVATION, type CollectionName, type DemoData } from "@/domain/engine";
import type { Session } from "@/types";
import type { Tx } from "./db";
import { fromRow, toRow, settingsFromRow, settingsToRow, unknownFields, WRITE_ORDER, SPECS } from "./mapping";
import { stable, syncActiveMoveOuts, syncPendingPayments, syncReservationSlots, bumpVersion, acquireWriteLock } from "./state";
import { saveFile } from "./files";

type Row = Record<string, unknown> & { id: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const del = (tx: Tx, c: CollectionName): any => (tx as unknown as Record<string, unknown>)[SPECS[c].delegate];

export interface ConflictItem {
  collection: CollectionName;
  id: string;
  fields: { field: string; current: unknown; incoming: unknown }[];
}
export interface RejectedItem {
  collection: CollectionName;
  id: string;
  reason: string;
}
export interface ImportPlan {
  counts: Record<string, { incoming: number; existing: number; new: number; identical: number; conflicts: number; rejected: number }>;
  newIds: Record<string, string[]>;
  conflicts: ConflictItem[];
  rejected: RejectedItem[];
  unknownFields: string[];
  settings: "novo" | "identico" | "conflito";
  files: { inline: number; withoutContent: number };
}

const REFS: Partial<Record<CollectionName, [string, CollectionName][]>> = {
  residents: [["apartmentId", "apartments"]],
  occupancies: [["apartmentId", "apartments"]],
  quotas: [["apartmentId", "apartments"]],
  payments: [
    ["quotaId", "quotas"],
    ["apartmentId", "apartments"],
  ],
  charges: [["apartmentId", "apartments"]],
  reservations: [
    ["hallId", "halls"],
    ["apartmentId", "apartments"],
  ],
  moveOuts: [["apartmentId", "apartments"]],
  visits: [["apartmentId", "apartments"]],
  visitChecks: [["visitId", "visits"]],
};

const ROLES = ["administrador", "gestor", "financeiro", "morador", "porteiro"];
/** Valores aceites pelas colunas ENUM (ex.: tipologias exclusivamente T2 e Duplex). */
const ENUMS: Partial<Record<CollectionName, Record<string, string[]>>> = {
  apartments: { typology: ["T2", "Duplex"] },
  quotas: { typology: ["T2", "Duplex"], status: ["pendente", "em_analise", "pago", "parcial", "em_atraso"] },
  payments: { status: ["em_analise", "aprovado", "rejeitado"], reviewedByRole: ROLES },
  reservations: { status: ["em_espera", "pendente_pagamento", "em_validacao", "confirmada", "cancelada", "expirada"] },
  moveOuts: {
    typology: ["T2", "Duplex"],
    status: ["solicitacao_recebida", "em_verificacao_financeira", "em_verificacao_operacional", "regularizacao_pendente", "aguardando_aprovacao", "autorizada", "concluida", "cancelada"],
  },
  audit: { role: ROLES },
};

/** Normaliza uma entidade como ficaria depois de gravada (datas, montantes, campos desconhecidos). */
function normalize(c: CollectionName, e: Row): Row {
  return fromRow(c, toRow(c, e)) as Row;
}

function countFiles(d: DemoData) {
  let inline = 0;
  let withoutContent = 0;
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.name === "string" && ("dataUrl" in o || "size" in o) && ("type" in o || "size" in o) && !("id" in o && "title" in o)) {
        if (typeof o.dataUrl === "string" && o.dataUrl.startsWith("data:")) inline++;
        else if (!o.fileId && ("dataUrl" in o || "type" in o)) withoutContent++;
      }
      Object.values(o).forEach(walk);
    }
  };
  for (const c of ["payments", "notices", "occurrences", "reservations", "moveOuts", "documents"] as const) walk(d[c]);
  return { inline, withoutContent };
}

export async function planImport(tx: Tx, incoming: DemoData): Promise<ImportPlan> {
  const plan: ImportPlan = { counts: {}, newIds: {}, conflicts: [], rejected: [], unknownFields: [], settings: "novo", files: countFiles(incoming) };
  const existingIds: Partial<Record<CollectionName, Set<string>>> = {};
  const existingRows: Partial<Record<CollectionName, Map<string, Row>>> = {};
  for (const c of COLLECTIONS) {
    const rows = ((await del(tx, c).findMany()) as Record<string, unknown>[]).map((r) => fromRow(c, r) as Row);
    existingRows[c] = new Map(rows.map((r) => [r.id, r]));
    existingIds[c] = new Set(rows.map((r) => r.id));
  }
  const unknown = new Set<string>();
  const accepted: Partial<Record<CollectionName, Set<string>>> = {};
  for (const c of WRITE_ORDER) {
    const list = ((incoming[c] ?? []) as unknown as Row[]).filter((r) => r && typeof r.id === "string");
    const cur = existingRows[c]!;
    const cnt = { incoming: list.length, existing: cur.size, new: 0, identical: 0, conflicts: 0, rejected: 0 };
    const ids: string[] = [];
    accepted[c] = new Set();
    for (const raw of list) {
      unknownFields(c, raw).forEach((f) => unknown.add(`${c}.${f}`));
      let row: Row;
      try {
        row = normalize(c, raw);
      } catch (e) {
        plan.rejected.push({ collection: c, id: raw.id, reason: e instanceof Error ? e.message : "dados inválidos" });
        cnt.rejected++;
        continue;
      }
      const badEnum = Object.entries(ENUMS[c] ?? {}).find(([f, allowed]) => row[f] !== undefined && !allowed.includes(String(row[f])));
      if (badEnum) {
        plan.rejected.push({ collection: c, id: row.id, reason: `valor não permitido em ${badEnum[0]}: ${row[badEnum[0]]}${badEnum[0] === "typology" ? " (apenas T2 e Duplex)" : ""}` });
        cnt.rejected++;
        continue;
      }
      const old = cur.get(row.id);
      if (old) {
        if (stable(old) === stable(row)) cnt.identical++;
        else {
          const fields = Object.keys({ ...old, ...row })
            .filter((k) => stable(old[k]) !== stable(row[k]))
            .map((k) => ({ field: k, current: old[k], incoming: row[k] }));
          plan.conflicts.push({ collection: c, id: row.id, fields });
          cnt.conflicts++;
        }
        accepted[c]!.add(row.id);
        continue;
      }
      // referências obrigatórias
      const missing = (REFS[c] ?? []).find(([field, target]) => row[field] && !existingIds[target]!.has(String(row[field])) && !accepted[target]!.has(String(row[field])));
      if (missing) {
        plan.rejected.push({ collection: c, id: row.id, reason: `referência inexistente: ${missing[0]} = ${row[missing[0]]}` });
        cnt.rejected++;
        continue;
      }
      if (c === "reservations" && BLOCKING_RESERVATION.includes(row.status as never)) {
        const clash = [...cur.values(), ...list.filter((x) => accepted.reservations!.has(x.id))].find(
          (x) => x.id !== row.id && x.hallId === row.hallId && String(x.date).slice(0, 10) === String(row.date).slice(0, 10) && BLOCKING_RESERVATION.includes(x.status as never),
        );
        if (clash) {
          plan.rejected.push({ collection: c, id: row.id, reason: `salão já reservado nesta data (reserva ${clash.id})` });
          cnt.rejected++;
          continue;
        }
      }
      if (c === "quotas" && [...cur.values()].some((q) => q.apartmentId === row.apartmentId && q.period === row.period)) {
        plan.rejected.push({ collection: c, id: row.id, reason: `já existe quota para ${row.apartmentId} em ${row.period}` });
        cnt.rejected++;
        continue;
      }
      accepted[c]!.add(row.id);
      ids.push(row.id);
      cnt.new++;
    }
    plan.counts[c] = cnt;
    plan.newIds[c] = ids;
  }
  const st = await tx.condoSettings.findUnique({ where: { id: 1 } });
  plan.settings = !st ? "novo" : stable(settingsFromRow(st)) === stable(settingsFromRow({ id: 1, ...settingsToRow(incoming.settings) } as never)) ? "identico" : "conflito";
  plan.unknownFields = [...unknown];
  return plan;
}

/** Converte anexos embebidos (data URL) em ficheiros guardados; nunca inventa conteúdos inexistentes. */
async function materializeFiles<T>(v: T, by: Session | null, residentId?: string | null): Promise<T> {
  if (Array.isArray(v)) return (await Promise.all(v.map((x) => materializeFiles(x, by, residentId)))) as T;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.dataUrl === "string" && o.dataUrl.startsWith("data:") && typeof o.name === "string") {
      const m = /^data:[^;,]*(;base64)?,([\s\S]*)$/.exec(o.dataUrl);
      if (m) {
        const buf = m[1] ? Buffer.from(m[2], "base64") : Buffer.from(decodeURIComponent(m[2]), "utf8");
        try {
          const saved = await saveFile(buf, o.name, by, residentId);
          const { dataUrl: _d, ...rest } = o;
          void _d;
          return { ...rest, fileId: saved.id } as T;
        } catch {
          const { dataUrl: _d, ...rest } = o;
          void _d;
          return { ...rest, unavailable: true } as T;
        }
      }
    }
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(o)) out[k] = k === "dataUrl" ? undefined : await materializeFiles(x, by, residentId);
    return out as T;
  }
  return v;
}

export interface ApplyOptions {
  /** "colecção:id" dos conflitos a substituir pelos dados importados (confirmação explícita). */
  overwrite?: string[];
  applySettings?: boolean;
  by: Session | null;
  source: string;
}

export async function applyImport(tx: Tx, incoming: DemoData, opts: ApplyOptions) {
  await acquireWriteLock(tx);
  const plan = await planImport(tx, incoming);
  const overwrite = new Set(opts.overwrite ?? []);
  let inserted = 0;
  let updated = 0;
  const touched: Partial<Record<CollectionName, Row[]>> = {};
  for (const c of WRITE_ORDER) {
    const newIds = new Set(plan.newIds[c] ?? []);
    const list = ((incoming[c] ?? []) as unknown as Row[]).filter((r) => r && (newIds.has(r.id) || overwrite.has(`${c}:${r.id}`)));
    const rows: Row[] = [];
    for (const r of list) rows.push((await materializeFiles(r, opts.by, (r.residentId as string) ?? null)) as Row);
    const toCreate = rows.filter((r) => newIds.has(r.id));
    const toUpdate = rows.filter((r) => !newIds.has(r.id) && plan.conflicts.some((x) => x.collection === c && x.id === r.id));
    for (let i = 0; i < toCreate.length; i += 200) await del(tx, c).createMany({ data: toCreate.slice(i, i + 200).map((r) => toRow(c, r)) });
    for (const r of toUpdate) {
      const { id, ...data } = toRow(c, r);
      await del(tx, c).update({ where: { id: id as string }, data });
    }
    inserted += toCreate.length;
    updated += toUpdate.length;
    touched[c] = [...toCreate, ...toUpdate];
  }
  if (touched.reservations?.length) await syncReservationSlots(tx, touched.reservations as unknown as DemoData["reservations"]);
  if (touched.payments?.length) await syncPendingPayments(tx, touched.payments as unknown as DemoData["payments"]);
  if (touched.moveOuts?.length) await syncActiveMoveOuts(tx, touched.moveOuts as unknown as DemoData["moveOuts"]);
  if (plan.settings === "novo" || (plan.settings === "conflito" && opts.applySettings)) {
    await tx.condoSettings.upsert({ where: { id: 1 }, create: { id: 1, ...settingsToRow(incoming.settings) }, update: settingsToRow(incoming.settings) });
  }
  const version = inserted || updated ? await bumpVersion(tx) : undefined;
  const summary = { inserted, updated, skippedConflicts: plan.conflicts.length - updated, rejected: plan.rejected.length, counts: plan.counts, rejectedItems: plan.rejected.slice(0, 500) };
  await tx.importRun.create({ data: { source: opts.source, by: opts.by?.name ?? "linha de comandos", mode: overwrite.size ? "inserir+substituir" : "inserir", summary: JSON.stringify(summary) } });
  return { ...summary, version };
}

/** Lê uma exportação do navegador (formato zustand persist ou o estado directo). */
export function parseBrowserExport(raw: unknown): DemoData {
  let v = raw as Record<string, unknown>;
  if (typeof v === "string") v = JSON.parse(v);
  if (v && typeof v === "object" && "state" in v && v.state && typeof v.state === "object") v = v.state as Record<string, unknown>;
  if (!v || typeof v !== "object" || !Array.isArray(v.apartments)) throw new Error("Ficheiro não reconhecido: não contém dados do Portal Residencial Laguna.");
  const out: Record<string, unknown> = { settings: v.settings };
  for (const c of COLLECTIONS) out[c] = Array.isArray(v[c]) ? v[c] : [];
  const st = v.settings as Record<string, unknown> | undefined;
  if (!st || typeof st !== "object" || !st.quotaByTypology) {
    // exportações antigas (quota única) — mantém a configuração oficial
    out.settings = { quotaByTypology: { T2: 300000, Duplex: 600000 }, dueDay: 15, allowPartial: true, reservationFee: 50000, reservationHoldHours: 48 };
  }
  return out as unknown as DemoData;
}
