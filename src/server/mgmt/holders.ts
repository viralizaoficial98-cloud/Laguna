/**
 * Proprietários e inquilinos (titularidade separada da residência) e ficha completa da fracção.
 * Um proprietário activo e um inquilino activo por fracção (tabela active_holder_slots); as substituições
 * encerram o registo anterior (histórico preservado).
 */
import type { Session } from "@/types";
import type { Tx } from "../db";
import { prisma } from "../db";
import { ActionError } from "../errors";
import { loadState } from "../state";
import { computeAccount } from "@/lib/account";
import { auditLog, cleanText, isoDate, mid, normalizeName, requirePerm, similarNames, toDateOnly, withWrite } from "./common";

export type HolderRole = "proprietario" | "inquilino";
const ROLES: HolderRole[] = ["proprietario", "inquilino"];

export interface PartyInput {
  name: string;
  kind?: string | null;
  nif?: string | null;
  email?: string | null;
  phone?: string | null;
  phone2?: string | null;
  address?: string | null;
  notes?: string | null;
}

function cleanParty(p: Partial<PartyInput>) {
  const out: Partial<PartyInput> = {};
  if (p.name !== undefined) {
    const n = cleanText(p.name);
    if (n.length < 2) throw new ActionError("Indique o nome (mínimo 2 caracteres).", 400);
    out.name = n.slice(0, 255);
  }
  for (const k of ["kind", "nif", "email", "phone", "phone2", "address", "notes"] as const) {
    if (p[k] !== undefined) out[k] = p[k] ? cleanText(p[k]).slice(0, k === "address" || k === "notes" ? 2000 : 190) || null : null;
  }
  if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(out.email)) throw new ActionError("Email inválido.", 400);
  return out;
}

export function publicParty(p: { id: string; name: string; kind: string | null; nif: string | null; email: string | null; phone: string | null; phone2: string | null; address: string | null; notes: string | null; archived: boolean; residentId: string | null; createdAt: Date }) {
  return { id: p.id, name: p.name, kind: p.kind, nif: p.nif, email: p.email, phone: p.phone, phone2: p.phone2, address: p.address, notes: p.notes, archived: p.archived, residentId: p.residentId, createdAt: p.createdAt.toISOString() };
}

/** Obtém (ou cria) a entidade pelo nome normalizado — evita duplicados. */
export async function findOrCreateParty(tx: Tx, input: PartyInput, by: string, source?: unknown) {
  const data = cleanParty(input) as PartyInput;
  const normalizedName = normalizeName(data.name);
  const existing = await tx.party.findFirst({ where: { normalizedName, archived: false } });
  if (existing) return { party: existing, created: false };
  const party = await tx.party.create({
    data: { id: mid("pty"), name: data.name, normalizedName, kind: data.kind ?? null, nif: data.nif ?? null, email: data.email ?? null, phone: data.phone ?? null, phone2: data.phone2 ?? null, address: data.address ?? null, notes: data.notes ?? null, source: source ? JSON.stringify(source) : null, createdBy: by },
  });
  return { party, created: true };
}

/**
 * Atribui o proprietário ou o inquilino activo de uma fracção. O anterior (se diferente) é encerrado.
 * Devolve "inalterado" quando a mesma entidade já é o titular activo.
 */
export async function assignHolderTx(tx: Tx, sess: { name: string; role: Session["role"] }, a: { apartmentId: string; role: HolderRole; partyId: string; from?: string | null; notes?: string | null; source?: string }) {
  if (!ROLES.includes(a.role)) throw new ActionError("Papel inválido (proprietário ou inquilino).", 400);
  const apt = await tx.apartment.findUnique({ where: { id: a.apartmentId } });
  if (!apt) throw new ActionError("Fracção inexistente.", 404);
  const slot = await tx.activeHolderSlot.findUnique({ where: { apartmentId_role: { apartmentId: a.apartmentId, role: a.role } } });
  if (slot) {
    const cur = await tx.fractionHolder.findUnique({ where: { id: slot.holderId } });
    if (cur?.partyId === a.partyId) return { status: "inalterado" as const, holderId: cur.id };
    const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
    await tx.fractionHolder.update({ where: { id: slot.holderId }, data: { active: false, to: a.from ? toDateOnly(a.from) : today, endedBy: sess.name, endReason: `Substituído${a.source ? ` (${a.source})` : ""}` } });
    await tx.activeHolderSlot.delete({ where: { apartmentId_role: { apartmentId: a.apartmentId, role: a.role } } });
  }
  const holder = await tx.fractionHolder.create({
    data: { id: mid("hld"), apartmentId: a.apartmentId, partyId: a.partyId, role: a.role, from: a.from ? toDateOnly(a.from) : null, active: true, source: a.source ?? "gestao", notes: a.notes ?? null, createdBy: sess.name },
  });
  await tx.activeHolderSlot.create({ data: { apartmentId: a.apartmentId, role: a.role, holderId: holder.id } });
  const party = await tx.party.findUnique({ where: { id: a.partyId } });
  // o nome do proprietário no cadastro acompanha o titular activo
  if (a.role === "proprietario" && party) await tx.apartment.update({ where: { id: a.apartmentId }, data: { ownerName: party.name } });
  await auditLog(tx, sess, slot ? `${a.role === "proprietario" ? "Proprietário" : "Inquilino"} substituído` : `${a.role === "proprietario" ? "Proprietário" : "Inquilino"} associado`, "apartment", a.apartmentId, `${party?.name ?? a.partyId}${a.source ? ` · ${a.source}` : ""}`);
  return { status: slot ? ("substituido" as const) : ("criado" as const), holderId: holder.id };
}

export async function assignHolder(sess: Session, a: { apartmentId: string; role: HolderRole; partyId?: string; party?: PartyInput; from?: string | null; notes?: string | null }) {
  requirePerm(sess, "holders.manage");
  return withWrite(async (tx) => {
    let partyId = a.partyId;
    if (!partyId) {
      if (!a.party) throw new ActionError("Indique a pessoa ou entidade.", 400);
      const r = await findOrCreateParty(tx, a.party, sess.name);
      partyId = r.party.id;
      if (r.created) await auditLog(tx, sess, "Titular registado", "party", partyId, r.party.name);
    }
    return assignHolderTx(tx, sess, { apartmentId: a.apartmentId, role: a.role, partyId, from: a.from, notes: a.notes });
  });
}

/** Encerra o titular activo (ex.: fim do arrendamento) — o registo fica no histórico. */
export async function endHolder(sess: Session, apartmentId: string, role: HolderRole, reason: string, to?: string) {
  requirePerm(sess, "holders.manage");
  if (!reason?.trim()) throw new ActionError("Indique o motivo.", 400);
  return withWrite(async (tx) => {
    const slot = await tx.activeHolderSlot.findUnique({ where: { apartmentId_role: { apartmentId, role } } });
    if (!slot) throw new ActionError("Não existe titular activo com este papel.", 404);
    await tx.fractionHolder.update({ where: { id: slot.holderId }, data: { active: false, to: to ? toDateOnly(to) : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z"), endedBy: sess.name, endReason: reason.trim() } });
    await tx.activeHolderSlot.delete({ where: { apartmentId_role: { apartmentId, role } } });
    await auditLog(tx, sess, `${role === "proprietario" ? "Proprietário" : "Inquilino"} encerrado`, "apartment", apartmentId, reason.trim());
    return { ok: true };
  });
}

export async function createParty(sess: Session, input: PartyInput) {
  requirePerm(sess, "holders.manage");
  return withWrite(async (tx) => {
    const r = await findOrCreateParty(tx, input, sess.name);
    if (!r.created) throw new ActionError(`Já existe um registo com este nome: ${r.party.name}.`, 409);
    await auditLog(tx, sess, "Titular registado", "party", r.party.id, r.party.name);
    return publicParty(r.party);
  });
}

export async function updateParty(sess: Session, id: string, input: Partial<PartyInput> & { archived?: boolean }) {
  requirePerm(sess, "holders.manage");
  return withWrite(async (tx) => {
    const cur = await tx.party.findUnique({ where: { id } });
    if (!cur) throw new ActionError("Registo inexistente.", 404);
    const data = cleanParty(input);
    if (data.name && normalizeName(data.name) !== cur.normalizedName) {
      const clash = await tx.party.findFirst({ where: { normalizedName: normalizeName(data.name), id: { not: id }, archived: false } });
      if (clash) throw new ActionError(`Já existe um registo com este nome: ${clash.name}. Utilize "Fundir".`, 409);
    }
    const updated = await tx.party.update({ where: { id }, data: { ...data, ...(data.name ? { normalizedName: normalizeName(data.name) } : {}), ...(input.archived !== undefined ? { archived: input.archived } : {}) } });
    if (data.name) {
      const owned = await tx.fractionHolder.findMany({ where: { partyId: id, role: "proprietario", active: true } });
      for (const h of owned) await tx.apartment.update({ where: { id: h.apartmentId }, data: { ownerName: updated.name } });
    }
    const changed = Object.keys(data).filter((k) => (cur as Record<string, unknown>)[k] !== (data as Record<string, unknown>)[k]);
    await auditLog(tx, sess, input.archived ? "Titular arquivado" : "Titular editado", "party", id, changed.map((k) => `${k}: ${(cur as Record<string, unknown>)[k] ?? "—"} → ${(data as Record<string, unknown>)[k] ?? "—"}`).join("; "));
    return publicParty(updated);
  });
}

/** Funde dois registos da mesma pessoa/entidade: as titularidades passam para o registo mantido. */
export async function mergeParties(sess: Session, keepId: string, mergeId: string) {
  requirePerm(sess, "holders.manage");
  if (keepId === mergeId) throw new ActionError("Seleccione dois registos diferentes.", 400);
  return withWrite(async (tx) => {
    const [keep, drop] = await Promise.all([tx.party.findUnique({ where: { id: keepId } }), tx.party.findUnique({ where: { id: mergeId } })]);
    if (!keep || !drop) throw new ActionError("Registo inexistente.", 404);
    const n = await tx.fractionHolder.updateMany({ where: { partyId: mergeId }, data: { partyId: keepId } });
    await tx.party.update({ where: { id: mergeId }, data: { archived: true, notes: `${drop.notes ? `${drop.notes}\n` : ""}Fundido em ${keep.name} (${keep.id}) por ${sess.name}.` } });
    const owned = await tx.fractionHolder.findMany({ where: { partyId: keepId, role: "proprietario", active: true } });
    for (const h of owned) await tx.apartment.update({ where: { id: h.apartmentId }, data: { ownerName: keep.name } });
    await auditLog(tx, sess, "Titulares fundidos", "party", keepId, `${drop.name} → ${keep.name} · ${n.count} titularidade(s)`);
    return { moved: n.count };
  });
}

export async function listParties(sess: Session) {
  requirePerm(sess, "residents.view");
  const [parties, holders, apts] = await Promise.all([prisma.party.findMany({ orderBy: { name: "asc" } }), prisma.fractionHolder.findMany({ orderBy: { createdAt: "asc" } }), prisma.apartment.findMany({ select: { id: true, block: true, number: true, typology: true } })]);
  const aptOf = new Map(apts.map((a) => [a.id, a]));
  const list = parties.map((p) => {
    const hs = holders.filter((h) => h.partyId === p.id);
    const frac = (role: HolderRole, active: boolean) => hs.filter((h) => h.role === role && h.active === active).map((h) => ({ holderId: h.id, apartmentId: h.apartmentId, label: aptOf.get(h.apartmentId) ? `${aptOf.get(h.apartmentId)!.block}-${aptOf.get(h.apartmentId)!.number}` : h.apartmentId, from: isoDate(h.from), to: isoDate(h.to) }));
    return { ...publicParty(p), owns: frac("proprietario", true), rents: frac("inquilino", true), past: [...frac("proprietario", false), ...frac("inquilino", false)] };
  });
  const active = list.filter((p) => !p.archived);
  const duplicates: { a: string; b: string; aName: string; bName: string }[] = [];
  for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) if (similarNames(active[i].name, active[j].name)) duplicates.push({ a: active[i].id, b: active[j].id, aName: active[i].name, bName: active[j].name });
  return { parties: list, possibleDuplicates: duplicates };
}

/** Lista de fracções com titulares, ocupante e situação financeira (para tabelas e pesquisa). */
export async function listFractions(sess: Session) {
  requirePerm(sess, "residents.view");
  const state = await prisma.$transaction((tx) => loadState(tx), { timeout: 60_000 });
  const slots = await prisma.activeHolderSlot.findMany();
  const holders = await prisma.fractionHolder.findMany({ where: { id: { in: slots.map((s) => s.holderId) } }, include: { party: true } });
  const hOf = (aptId: string, role: HolderRole) => holders.find((h) => h.apartmentId === aptId && h.role === role)?.party;
  return state.apartments
    .slice()
    .sort((a, b) => (a.block + a.number).localeCompare(b.block + b.number))
    .map((a) => {
      const resident = state.residents.find((r) => r.id === a.residentId);
      const acc = computeAccount({ apartmentId: a.id, quotas: state.quotas, payments: state.payments, charges: state.charges, reservations: state.reservations });
      const owner = hOf(a.id, "proprietario");
      const tenant = hOf(a.id, "inquilino");
      return {
        id: a.id,
        code: `${a.block}-${a.number}`,
        block: a.block,
        number: a.number,
        typology: a.typology,
        status: a.status,
        active: a.active,
        ownerName: owner?.name ?? a.ownerName ?? null,
        ownerRegistered: !!owner,
        tenantName: tenant?.name ?? null,
        residentName: resident?.name ?? null,
        residentId: resident?.id ?? null,
        debt: acc.confirmedDebt,
        inValidation: acc.inValidation,
        paid: acc.paidTotal,
      };
    });
}

/** Ficha completa de uma fracção. */
export async function getFraction(sess: Session, apartmentId: string) {
  requirePerm(sess, "residents.view");
  const state = await prisma.$transaction((tx) => loadState(tx), { timeout: 60_000 });
  const apt = state.apartments.find((a) => a.id === apartmentId);
  if (!apt) throw new ActionError("Fracção inexistente.", 404);
  const [holders, declarations, files, audit] = await Promise.all([
    prisma.fractionHolder.findMany({ where: { apartmentId }, include: { party: true }, orderBy: { createdAt: "desc" } }),
    prisma.declaration.findMany({ where: { apartmentId }, orderBy: { requestedAt: "desc" } }),
    prisma.storedFile.findMany({ where: { apartmentId }, orderBy: { createdAt: "desc" } }),
    prisma.auditEntry.findMany({ where: { OR: [{ entityId: apartmentId }, { details: { contains: `${apt.block} · ${apt.number}` } }] }, orderBy: { at: "desc" }, take: 100 }),
  ]);
  const resident = state.residents.find((r) => r.id === apt.residentId) ?? null;
  const occupancies = state.occupancies.filter((o) => o.apartmentId === apartmentId).sort((a, b) => b.from.localeCompare(a.from));
  const formerResidents = state.residents.filter((r) => occupancies.some((o) => o.residentId === r.id) && r.id !== resident?.id);
  const occupancy = occupancies.find((o) => o.residentId === resident?.id && !o.to);
  const account = computeAccount({ apartmentId, quotas: state.quotas, payments: state.payments, charges: state.charges, reservations: state.reservations, occupancy });
  const accountAll = computeAccount({ apartmentId, quotas: state.quotas, payments: state.payments, charges: state.charges, reservations: state.reservations });
  const payments = state.payments.filter((p) => p.apartmentId === apartmentId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return {
    apartment: apt,
    owner: holders.find((h) => h.role === "proprietario" && h.active) ?? null,
    tenant: holders.find((h) => h.role === "inquilino" && h.active) ?? null,
    holderHistory: holders.map((h) => ({ id: h.id, role: h.role, active: h.active, from: isoDate(h.from), to: isoDate(h.to), source: h.source, party: publicParty(h.party), createdBy: h.createdBy, endedBy: h.endedBy, endReason: h.endReason, createdAt: h.createdAt.toISOString() })),
    resident,
    formerResidents,
    occupancies,
    account: { ...account, lines: undefined },
    accountAll: { quotasTotal: accountAll.quotasTotal, paidTotal: accountAll.paidTotal, confirmedDebt: accountAll.confirmedDebt, inValidation: accountAll.inValidation },
    quotas: state.quotas.filter((q) => q.apartmentId === apartmentId).sort((a, b) => b.period.localeCompare(a.period)),
    payments,
    receipts: payments.filter((p) => p.receiptNumber).map((p) => ({ paymentId: p.id, receiptNumber: p.receiptNumber, amount: p.validatedAmount ?? p.amount, at: p.reviewedAt })),
    declarations: declarations.map((d) => ({ id: d.id, number: d.number, typeCode: d.typeCode, status: d.status, subjectName: d.subjectName, requestedAt: d.requestedAt.toISOString(), signedAt: d.signedAt?.toISOString() ?? null, pdfFileId: d.pdfFileId })),
    files: files.filter((f) => f.category !== "signature").map((f) => ({ id: f.id, name: f.originalName, mime: f.mime, size: f.size, category: f.category, createdAt: f.createdAt.toISOString() })),
    moveOuts: state.moveOuts.filter((m) => m.apartmentId === apartmentId),
    audit: audit.map((a) => ({ at: a.at.toISOString(), by: a.by, action: a.action, details: a.details })),
  };
}
