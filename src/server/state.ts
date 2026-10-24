/**
 * Leitura e escrita do estado de negócio na base de dados.
 * As escritas são feitas por diferença (inserir / actualizar / eliminar) dentro de uma transacção,
 * depois de obtido o trinco de escrita (SELECT … FOR UPDATE em app_meta).
 */
import { COLLECTIONS, BLOCKING_RESERVATION, type CollectionName, type DemoData } from "@/domain/engine";
import { DEFAULT_SETTINGS } from "@/data/management";
import type { Tx } from "./db";
import { SPECS, WRITE_ORDER, fromRow, settingsFromRow, settingsToRow, toRow } from "./mapping";

type Row = Record<string, unknown> & { id: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDelegate = any;
const delegate = (tx: Tx, c: CollectionName): AnyDelegate => (tx as unknown as Record<string, AnyDelegate>)[SPECS[c].delegate];

export class ConflictError extends Error {
  status = 409;
}

export async function loadState(tx: Tx): Promise<DemoData> {
  const [settingsRow, ...lists] = await Promise.all([tx.condoSettings.findUnique({ where: { id: 1 } }), ...COLLECTIONS.map((c) => delegate(tx, c).findMany())]);
  const out = { settings: settingsRow ? settingsFromRow(settingsRow) : DEFAULT_SETTINGS } as DemoData;
  COLLECTIONS.forEach((c, i) => {
    (out as unknown as Record<string, unknown>)[c] = (lists[i] as Record<string, unknown>[]).map((r) => fromRow(c, r));
  });
  // ordem estável e próxima da apresentação original
  out.notifications.sort((a, b) => b.at.localeCompare(a.at));
  out.audit.sort((a, b) => b.at.localeCompare(a.at));
  out.payments.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  out.reservations.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  out.moveOuts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  out.accessLogs.sort((a, b) => b.at.localeCompare(a.at));
  return out;
}

/** Serialização estável para comparar entidades (ignora `undefined` e a ordem das chaves). */
export function stable(v: unknown): string {
  if (v === undefined) return "";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  return `{${Object.keys(v as object)
    .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

export interface Diff {
  collection: CollectionName;
  added: Row[];
  changed: Row[];
  removed: string[];
}

export function diffState(before: DemoData, after: DemoData): { diffs: Diff[]; settingsChanged: boolean } {
  const diffs: Diff[] = [];
  for (const c of COLLECTIONS) {
    const a = before[c] as unknown as Row[];
    const b = after[c] as unknown as Row[];
    if (a === b) continue;
    const prev = new Map(a.map((r) => [r.id, r]));
    const next = new Map(b.map((r) => [r.id, r]));
    const d: Diff = { collection: c, added: [], changed: [], removed: [] };
    for (const [id, r] of next) {
      const old = prev.get(id);
      if (!old) d.added.push(r);
      else if (old !== r && stable(old) !== stable(r)) d.changed.push(r);
    }
    for (const id of prev.keys()) if (!next.has(id)) d.removed.push(id);
    if (d.added.length || d.changed.length || d.removed.length) diffs.push(d);
  }
  return { diffs, settingsChanged: stable(before.settings) !== stable(after.settings) };
}

/** Grava as diferenças. Devolve o número de registos afectados. */
export async function persistDiff(tx: Tx, before: DemoData, after: DemoData) {
  const { diffs, settingsChanged } = diffState(before, after);
  const by = new Map(diffs.map((d) => [d.collection, d]));
  let changes = 0;
  // eliminações: filhos antes dos pais
  for (const c of [...WRITE_ORDER].reverse()) {
    const d = by.get(c);
    if (!d?.removed.length) continue;
    if (c === "reservations") await tx.reservationSlot.deleteMany({ where: { reservationId: { in: d.removed } } });
    if (c === "payments") await tx.pendingPaymentSlot.deleteMany({ where: { paymentId: { in: d.removed } } });
    if (c === "moveOuts") await tx.activeMoveOut.deleteMany({ where: { moveOutId: { in: d.removed } } });
    await delegate(tx, c).deleteMany({ where: { id: { in: d.removed } } });
    changes += d.removed.length;
  }
  for (const c of WRITE_ORDER) {
    const d = by.get(c);
    if (!d) continue;
    if (d.added.length) {
      await delegate(tx, c).createMany({ data: d.added.map((r) => toRow(c, r)) });
      changes += d.added.length;
    }
    for (const r of d.changed) {
      const { id, ...data } = toRow(c, r);
      await delegate(tx, c).update({ where: { id: id as string }, data });
      changes += 1;
    }
    const touched = [...d.added, ...d.changed];
    if (!touched.length) continue;
    if (c === "reservations") await syncReservationSlots(tx, touched as unknown as DemoData["reservations"]);
    if (c === "payments") await syncPendingPayments(tx, touched as unknown as DemoData["payments"]);
    if (c === "moveOuts") await syncActiveMoveOuts(tx, touched as unknown as DemoData["moveOuts"]);
  }
  if (settingsChanged) {
    await tx.condoSettings.upsert({ where: { id: 1 }, create: { id: 1, ...settingsToRow(after.settings) }, update: settingsToRow(after.settings) });
    changes += 1;
  }
  return changes;
}

function isUniqueViolation(e: unknown) {
  return !!e && typeof e === "object" && (e as { code?: string }).code === "P2002";
}

/** Exclusividade salão + data garantida pela chave primária de reservation_slots. */
export async function syncReservationSlots(tx: Tx, list: DemoData["reservations"]) {
  // libertar primeiro (cancelamento/expiração) e só depois ocupar (ex.: promoção da lista de espera)
  const ordered = [...list].sort((a, b) => Number(BLOCKING_RESERVATION.includes(a.status)) - Number(BLOCKING_RESERVATION.includes(b.status)));
  for (const r of ordered) {
    const blocking = BLOCKING_RESERVATION.includes(r.status);
    const current = await tx.reservationSlot.findUnique({ where: { reservationId: r.id } });
    const date = new Date(`${r.date}T00:00:00.000Z`);
    if (current && (!blocking || current.hallId !== r.hallId || current.date.getTime() !== date.getTime())) {
      await tx.reservationSlot.delete({ where: { reservationId: r.id } });
    }
    if (blocking && !(current && current.hallId === r.hallId && current.date.getTime() === date.getTime())) {
      try {
        await tx.reservationSlot.create({ data: { hallId: r.hallId, date, reservationId: r.id } });
      } catch (e) {
        if (isUniqueViolation(e)) throw new ConflictError("Este salão já se encontra reservado para a data seleccionada. Por favor, escolha outra data disponível.");
        throw e;
      }
    }
  }
}

/** Um único comprovativo em validação por quota. */
export async function syncPendingPayments(tx: Tx, list: DemoData["payments"]) {
  const ordered = [...list].sort((a, b) => Number(a.status === "em_analise") - Number(b.status === "em_analise"));
  for (const p of ordered) {
    if (p.status === "em_analise") {
      const cur = await tx.pendingPaymentSlot.findUnique({ where: { paymentId: p.id } });
      if (cur) continue;
      try {
        await tx.pendingPaymentSlot.create({ data: { quotaId: p.quotaId, paymentId: p.id } });
      } catch (e) {
        if (isUniqueViolation(e)) throw new ConflictError("Já existe um comprovativo em validação para esta quota.");
        throw e;
      }
    } else {
      await tx.pendingPaymentSlot.deleteMany({ where: { paymentId: p.id } });
    }
  }
}

/** Um processo de desocupação activo por morador. */
export async function syncActiveMoveOuts(tx: Tx, list: DemoData["moveOuts"]) {
  const active = (m: DemoData["moveOuts"][number]) => !["concluida", "cancelada"].includes(m.status);
  const ordered = [...list].sort((a, b) => Number(active(a)) - Number(active(b)));
  for (const m of ordered) {
    if (!["concluida", "cancelada"].includes(m.status)) {
      const cur = await tx.activeMoveOut.findUnique({ where: { moveOutId: m.id } });
      if (cur) continue;
      try {
        await tx.activeMoveOut.create({ data: { residentId: m.residentId, moveOutId: m.id } });
      } catch (e) {
        if (isUniqueViolation(e)) throw new ConflictError("Já existe um processo de desocupação em curso.");
        throw e;
      }
    } else {
      await tx.activeMoveOut.deleteMany({ where: { moveOutId: m.id } });
    }
  }
}

/** Obtém o trinco de escrita global (serializa as escritas — volume de um condomínio). */
export async function acquireWriteLock(tx: Tx) {
  // a linha id=1 é criada pela migração 20261024000100_app_meta_row
  const rows = (await tx.$queryRawUnsafe("SELECT dataVersion FROM app_meta WHERE id = 1 FOR UPDATE")) as { dataVersion: number }[];
  if (!rows.length) throw new Error("Tabela app_meta sem a linha de controlo. Execute: npm run db:migrate");
  return Number(rows[0].dataVersion);
}

/** Conflitos transitórios de concorrência (deadlock / timeout de trinco) que justificam repetir. */
export function isTransientConflict(e: unknown) {
  const err = e as { code?: string; message?: string; meta?: { driverAdapterError?: { cause?: { kind?: string } } } };
  const text = `${err?.code ?? ""} ${err?.message ?? ""} ${JSON.stringify(err?.meta ?? {})}`;
  return /P2034|1213|1205|Deadlock|TransactionWriteConflict|Lock wait timeout/i.test(text);
}

export async function bumpVersion(tx: Tx) {
  await tx.$executeRawUnsafe("UPDATE app_meta SET dataVersion = dataVersion + 1, updatedAt = NOW(3) WHERE id = 1");
  const rows = (await tx.$queryRawUnsafe("SELECT dataVersion FROM app_meta WHERE id = 1")) as { dataVersion: number }[];
  return Number(rows[0]?.dataVersion ?? 0);
}

export async function currentVersion(tx: Tx) {
  const m = await tx.appMeta.findUnique({ where: { id: 1 } });
  return m?.dataVersion ?? 0;
}
