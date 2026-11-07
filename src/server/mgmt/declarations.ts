/**
 * Declarações do condomínio: pedido pelo morador (ou emissão directa pela gestão), análise, verificação dos
 * requisitos com dados do sistema, assinatura pelo responsável (com confirmação), PDF com QR e disponibilização.
 * Estados: solicitada → em_analise → aguardando_assinatura → emitida; rejeitada; cancelada; anulada (revogada).
 */
import { createHash, randomBytes } from "node:crypto";
import type { Session } from "@/types";
import { prisma, type Tx } from "../db";
import { ActionError } from "../errors";
import { saveFile } from "../files";
import { appUrl } from "../auth";
import { loadState } from "../state";
import { computeAccount } from "@/lib/account";
import { siteConfig } from "@/config/site";
import { formatLongDatePT } from "@/lib/utils";
import { auditLog, isoDate, mid, normalizeName, notify, requirePerm, withWrite } from "./common";
import { buildDeclarationPdf } from "./declaration-pdf";
import { imageSignatureProvider, loadActiveSignatureImage } from "./signature";

export type DeclStatus = "solicitada" | "em_analise" | "aguardando_assinatura" | "emitida" | "rejeitada" | "cancelada" | "anulada";

const ADDRESS = `${siteConfig.letterheadName}, ${siteConfig.location.street}, ${siteConfig.location.district}, ${siteConfig.location.city}, ${siteConfig.location.country}`;

export const DEFAULT_TYPES = [
  {
    code: "residencia",
    name: "Declaração de residência no condomínio",
    requirement: "residencia",
    template:
      "Para os devidos efeitos, a Administração do {{condominio}} declara que {{nome}} reside na fracção {{fraccao}} (Bloco {{bloco}}, tipologia {{tipologia}}) deste condomínio, sito em {{morada}}{{desde_texto}}.\n\nA presente declaração destina-se a {{finalidade}} e é emitida com base nos registos do condomínio.",
  },
  {
    code: "morada",
    name: "Declaração de morada",
    requirement: "residencia",
    template: "A Administração do {{condominio}} declara, para os devidos efeitos, que {{nome}} tem como morada a fracção {{fraccao}}, Bloco {{bloco}}, do {{condominio}}, {{morada}}.\n\nA presente declaração destina-se a {{finalidade}}.",
  },
  {
    code: "titularidade",
    name: "Declaração de titularidade da fracção",
    requirement: "titularidade",
    template:
      "A Administração do {{condominio}} declara que, de acordo com os registos do condomínio e com a documentação apresentada, {{nome}} figura como proprietário(a) da fracção {{fraccao}} (Bloco {{bloco}}, tipologia {{tipologia}}).\n\nA presente declaração não substitui o registo predial e destina-se a {{finalidade}}.",
  },
  {
    code: "situacao_financeira",
    name: "Declaração de situação financeira",
    requirement: "situacao_financeira",
    template:
      "A Administração do {{condominio}} declara que, à data de {{data}}, a fracção {{fraccao}} (Bloco {{bloco}}) apresenta a seguinte situação perante o condomínio no período de ocupação de {{nome}}: quotas emitidas {{quotas_emitidas}}; valores pagos {{valores_pagos}}; valores em dívida vencidos {{divida_vencida}}; pagamentos em validação {{em_validacao}}.\n\nA presente declaração destina-se a {{finalidade}}.",
  },
  {
    code: "quotas_regularizadas",
    name: "Declaração de quotas regularizadas",
    requirement: "sem_divida",
    template:
      "A Administração do {{condominio}} declara que, à data de {{data}}, a fracção {{fraccao}} (Bloco {{bloco}}), ocupada por {{nome}}, não apresenta quotas vencidas nem outros valores em dívida confirmados perante o condomínio.\n\nA presente declaração destina-se a {{finalidade}}.",
  },
  {
    code: "outra",
    name: "Outra declaração administrativa",
    requirement: "nenhum",
    template: "A Administração do {{condominio}} declara, relativamente a {{nome}}, fracção {{fraccao}} (Bloco {{bloco}}), o seguinte:\n\n[texto a redigir pela Administração]\n\nA presente declaração destina-se a {{finalidade}}.",
  },
];

export async function ensureTypes() {
  const n = await prisma.declarationType.count();
  if (n) return;
  await prisma.declarationType.createMany({ data: DEFAULT_TYPES.map((t, i) => ({ ...t, position: i, active: true, residentCanRequest: true })), skipDuplicates: true });
}

export async function listTypes(sess: Session) {
  await ensureTypes();
  const types = await prisma.declarationType.findMany({ orderBy: { position: "asc" } });
  return sess.role === "morador" ? types.filter((t) => t.active && t.residentCanRequest) : types;
}

export async function saveType(sess: Session, t: { code: string; name: string; template: string; requirement: string; active?: boolean; residentCanRequest?: boolean; description?: string }) {
  requirePerm(sess, "declarations.manage");
  if (!/^[a-z0-9_]{3,40}$/.test(t.code)) throw new ActionError("Código inválido (a-z, 0-9, _).", 400);
  if (!["nenhum", "residencia", "titularidade", "sem_divida", "situacao_financeira"].includes(t.requirement)) throw new ActionError("Requisito inválido.", 400);
  if (!t.name?.trim() || !t.template?.trim()) throw new ActionError("Indique o nome e o modelo do texto.", 400);
  return withWrite(async (tx) => {
    const r = await tx.declarationType.upsert({
      where: { code: t.code },
      create: { code: t.code, name: t.name.trim(), template: t.template, requirement: t.requirement, description: t.description ?? null, active: t.active ?? true, residentCanRequest: t.residentCanRequest ?? true, position: 100 },
      update: { name: t.name.trim(), template: t.template, requirement: t.requirement, description: t.description ?? null, active: t.active ?? true, residentCanRequest: t.residentCanRequest ?? true },
    });
    await auditLog(tx, sess, "Tipo de declaração guardado", "declaration_type", t.code, t.name);
    return r;
  }, { bump: false });
}

type Hist = { at: string; by: string; text: string; status?: DeclStatus };
const hist = (h: string | null | undefined): Hist[] => (h ? JSON.parse(h) : []);
const push = (h: string, e: Omit<Hist, "at">) => JSON.stringify([...hist(h), { ...e, at: new Date().toISOString() }]);

async function nextNumber(tx: Tx) {
  const year = new Date().getFullYear();
  const n = await tx.declaration.count({ where: { number: { startsWith: `DEC-${year}-` } } });
  return `DEC-${year}-${String(n + 1).padStart(4, "0")}`;
}

/** Dados verificados no sistema + verificação dos requisitos do tipo de declaração. */
async function verify(tx: Tx, decl: { apartmentId: string; residentId: string | null; subjectName: string }, requirement: string, ownershipConfirmed: boolean) {
  const state = await loadState(tx);
  const apt = state.apartments.find((a) => a.id === decl.apartmentId);
  if (!apt) throw new ActionError("Fracção inexistente.", 404);
  const resident = state.residents.find((r) => r.id === apt.residentId && r.status === "activo") ?? null;
  const slots = await tx.activeHolderSlot.findMany({ where: { apartmentId: apt.id } });
  const holders = await tx.fractionHolder.findMany({ where: { id: { in: slots.map((s) => s.holderId) } }, include: { party: true } });
  const owner = holders.find((h) => h.role === "proprietario")?.party ?? null;
  const tenant = holders.find((h) => h.role === "inquilino")?.party ?? null;
  const occupancy = state.occupancies.find((o) => o.apartmentId === apt.id && o.residentId === resident?.id && !o.to);
  const acc = computeAccount({ apartmentId: apt.id, quotas: state.quotas, payments: state.payments, charges: state.charges, reservations: state.reservations, occupancy });
  const subj = normalizeName(decl.subjectName);
  const checks: { label: string; ok: boolean; detail: string }[] = [];
  if (requirement === "residencia") {
    const isResident = !!resident && normalizeName(resident.name) === subj;
    const isTenant = !!tenant && normalizeName(tenant.name) === subj;
    checks.push({ label: "Residente ou inquilino registado na fracção", ok: isResident || isTenant, detail: resident || tenant ? `Morador: ${resident?.name ?? "—"} · Inquilino: ${tenant?.name ?? "—"}` : "Sem morador nem inquilino registado." });
  }
  if (requirement === "titularidade") {
    checks.push({ label: "Proprietário registado na fracção", ok: !!owner && normalizeName(owner.name) === subj, detail: owner ? `Proprietário registado: ${owner.name}` : "Sem proprietário registado." });
    checks.push({ label: "Titularidade comprovada por documento (confirmação da gestão)", ok: ownershipConfirmed, detail: ownershipConfirmed ? "Confirmado." : "Confirme que a documentação de titularidade foi apresentada e verificada." });
  }
  if (requirement === "sem_divida") {
    checks.push({ label: "Sem dívidas confirmadas", ok: acc.confirmedDebt === 0, detail: `Dívida confirmada: ${acc.confirmedDebt.toLocaleString("pt-PT")} Kz` });
    checks.push({ label: "Sem pagamentos por validar", ok: acc.inValidation === 0, detail: `Em validação: ${acc.inValidation.toLocaleString("pt-PT")} Kz` });
  }
  const kz = (v: number) => `${v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;
  const vars: Record<string, string> = {
    condominio: siteConfig.letterheadName,
    nome: decl.subjectName,
    fraccao: `${apt.block}-${apt.number}`,
    bloco: apt.block,
    numero: apt.number,
    tipologia: apt.typology === "Duplex" ? "Duplex (3 quartos, sala e varanda)" : "T2",
    morada: `${siteConfig.location.street}, ${siteConfig.location.district}, ${siteConfig.location.city}`,
    data: formatLongDatePT(new Date().toISOString().slice(0, 10)),
    desde_texto: resident && normalizeName(resident.name) === subj && resident.since ? `, desde ${formatLongDatePT(resident.since)}` : "",
    proprietario: owner?.name ?? "—",
    quotas_emitidas: kz(acc.quotasTotal),
    valores_pagos: kz(acc.paidTotal),
    divida_vencida: kz(acc.confirmedDebt),
    em_validacao: kz(acc.inValidation),
  };
  return { apt, resident, owner, tenant, account: acc, checks, ok: checks.every((c) => c.ok), vars };
}

const fill = (template: string, vars: Record<string, string>, purpose: string | null) => template.replace(/\{\{(\w+)\}\}/g, (_, k) => (k === "finalidade" ? purpose?.trim() || "os fins tidos por convenientes" : vars[k] ?? ""));

function publicDecl(d: Awaited<ReturnType<typeof prisma.declaration.findFirstOrThrow>>, typeName: string | undefined, staff: boolean) {
  return {
    id: d.id,
    number: d.number,
    typeCode: d.typeCode,
    typeName: typeName ?? d.typeCode,
    apartmentId: d.apartmentId,
    residentId: d.residentId,
    subjectName: d.subjectName,
    purpose: d.purpose,
    status: d.status as DeclStatus,
    channel: d.channel,
    requestedByName: d.requestedByName,
    requestedAt: d.requestedAt.toISOString(),
    content: staff || d.status === "emitida" ? d.content : null,
    checks: staff && d.checks ? JSON.parse(d.checks) : null,
    reviewedBy: d.reviewedBy,
    rejectionReason: d.rejectionReason,
    signerName: d.signerName,
    signerTitle: d.signerTitle,
    signedAt: d.signedAt?.toISOString() ?? null,
    pdfFileId: d.status === "emitida" || staff ? d.pdfFileId : null,
    verificationCode: d.status === "emitida" || staff ? d.verificationCode : null,
    revokedAt: d.revokedAt?.toISOString() ?? null,
    revokeReason: d.revokeReason,
    history: hist(d.history),
  };
}

export async function listDeclarations(sess: Session) {
  await ensureTypes();
  const staff = sess.role === "administrador" || sess.role === "gestor";
  if (!staff && sess.role !== "morador") throw new ActionError("Sem acesso às declarações.", 403);
  if (sess.role === "morador" && !sess.residentId) return { declarations: [], types: [] };
  const [rows, types] = await Promise.all([
    prisma.declaration.findMany({ where: staff ? {} : { residentId: sess.residentId }, orderBy: { requestedAt: "desc" }, take: 500 }),
    listTypes(sess),
  ]);
  const name = new Map(types.map((t) => [t.code, t.name]));
  return { declarations: rows.map((d) => publicDecl(d, name.get(d.typeCode), staff)), types };
}

/** Pedido do morador (perfil) — Nelson e a Administração são notificados. */
export async function requestDeclaration(sess: Session, input: { typeCode: string; purpose?: string }) {
  requirePerm(sess, "declarations.request");
  await ensureTypes();
  const type = await prisma.declarationType.findUnique({ where: { code: input.typeCode } });
  if (!type || !type.active || !type.residentCanRequest) throw new ActionError("Tipo de declaração indisponível.", 400);
  return withWrite(async (tx) => {
    const resident = sess.residentId ? await tx.resident.findUnique({ where: { id: sess.residentId } }) : null;
    if (!resident?.apartmentId) throw new ActionError("A sua conta não está associada a uma fracção.", 400);
    const dup = await tx.declaration.findFirst({ where: { residentId: resident.id, typeCode: type.code, status: { in: ["solicitada", "em_analise", "aguardando_assinatura"] } } });
    if (dup) throw new ActionError(`Já existe um pedido em curso deste tipo (${dup.number}).`, 409);
    const number = await nextNumber(tx);
    const d = await tx.declaration.create({
      data: {
        id: mid("dec"),
        number,
        typeCode: type.code,
        apartmentId: resident.apartmentId,
        residentId: resident.id,
        subjectName: resident.name,
        purpose: input.purpose?.trim().slice(0, 500) || null,
        status: "solicitada",
        channel: "portal",
        requestedByUserId: sess.userId,
        requestedByName: sess.name,
        requestedAt: new Date(),
        history: JSON.stringify([{ at: new Date().toISOString(), by: sess.name, text: "Declaração solicitada pelo morador.", status: "solicitada" }]),
      },
    });
    await notify(tx, { title: `Pedido de declaração ${number}`, body: `${type.name} — ${resident.name}`, roles: ["gestor", "administrador"], href: "/painel/declaracoes" });
    await auditLog(tx, sess, "Declaração solicitada", "declaration", d.id, `${number} · ${type.name}`);
    return publicDecl(d, type.name, false);
  });
}

/** Emissão directa pela gestão (pedido presencial). */
export async function createDeclaration(sess: Session, input: { typeCode: string; apartmentId: string; subject: "morador" | "proprietario" | "inquilino"; purpose?: string }) {
  requirePerm(sess, "declarations.manage");
  await ensureTypes();
  const type = await prisma.declarationType.findUnique({ where: { code: input.typeCode } });
  if (!type || !type.active) throw new ActionError("Tipo de declaração indisponível.", 400);
  return withWrite(async (tx) => {
    const apt = await tx.apartment.findUnique({ where: { id: input.apartmentId } });
    if (!apt) throw new ActionError("Seleccione a fracção.", 400);
    let subjectName: string | null = null;
    let residentId: string | null = null;
    let partyId: string | null = null;
    if (input.subject === "morador") {
      const r = apt.residentId ? await tx.resident.findUnique({ where: { id: apt.residentId } }) : null;
      if (!r) throw new ActionError("A fracção não tem morador registado.", 400);
      subjectName = r.name;
      residentId = r.id;
    } else {
      const slot = await tx.activeHolderSlot.findUnique({ where: { apartmentId_role: { apartmentId: apt.id, role: input.subject } } });
      const h = slot ? await tx.fractionHolder.findUnique({ where: { id: slot.holderId }, include: { party: true } }) : null;
      if (!h) throw new ActionError(`A fracção não tem ${input.subject === "proprietario" ? "proprietário" : "inquilino"} registado.`, 400);
      subjectName = h.party.name;
      partyId = h.partyId;
      residentId = h.party.residentId;
    }
    const number = await nextNumber(tx);
    const d = await tx.declaration.create({
      data: {
        id: mid("dec"),
        number,
        typeCode: type.code,
        apartmentId: apt.id,
        residentId,
        partyId,
        subjectName,
        purpose: input.purpose?.trim().slice(0, 500) || null,
        status: "em_analise",
        channel: "presencial",
        requestedByUserId: sess.userId,
        requestedByName: sess.name,
        requestedAt: new Date(),
        reviewedBy: sess.name,
        history: JSON.stringify([{ at: new Date().toISOString(), by: sess.name, text: "Pedido presencial registado pela gestão.", status: "em_analise" }]),
      },
    });
    await auditLog(tx, sess, "Declaração criada (presencial)", "declaration", d.id, `${number} · ${type.name} · ${subjectName}`);
    return publicDecl(d, type.name, true);
  });
}

export type DeclOp =
  | { op: "review" }
  | { op: "prepare"; content?: string; ownershipConfirmed?: boolean }
  | { op: "sign"; confirm: boolean }
  | { op: "reject"; reason: string }
  | { op: "cancel"; reason?: string }
  | { op: "revoke"; reason: string };

export async function declarationOp(sess: Session, id: string, o: DeclOp, req?: Request) {
  return withWrite(async (tx) => {
    const d = await tx.declaration.findUnique({ where: { id } });
    if (!d) throw new ActionError("Declaração inexistente.", 404);
    const type = await tx.declarationType.findUnique({ where: { code: d.typeCode } });
    if (!type) throw new ActionError("Tipo de declaração inexistente.", 400);
    const own = sess.role === "morador" && d.residentId === sess.residentId && !!sess.residentId;
    const staff = sess.role === "administrador" || sess.role === "gestor";
    const status = d.status as DeclStatus;
    const save = async (data: Parameters<typeof tx.declaration.update>[0]["data"], text: string, next: DeclStatus) => {
      const u = await tx.declaration.update({ where: { id }, data: { ...data, status: next, history: push(d.history, { by: sess.name, text, status: next }) } });
      await auditLog(tx, sess, `Declaração: ${text}`, "declaration", id, d.number);
      return publicDecl(u, type.name, staff);
    };

    switch (o.op) {
      case "review": {
        requirePerm(sess, "declarations.manage");
        if (status !== "solicitada") throw new ActionError("Só pedidos 'Solicitada' podem passar a análise.", 400);
        return save({ reviewedBy: sess.name }, "Pedido em análise.", "em_analise");
      }
      case "prepare": {
        requirePerm(sess, "declarations.manage");
        if (!["em_analise", "aguardando_assinatura"].includes(status)) throw new ActionError("A declaração não está em análise.", 400);
        const v = await verify(tx, d, type.requirement, !!o.ownershipConfirmed);
        await tx.declaration.update({ where: { id }, data: { checks: JSON.stringify({ at: new Date().toISOString(), ownershipConfirmed: !!o.ownershipConfirmed, items: v.checks }) } });
        if (!v.ok) throw new ActionError(`Requisitos não cumpridos: ${v.checks.filter((c) => !c.ok).map((c) => `${c.label} (${c.detail})`).join("; ")}`, 422);
        const content = (o.content?.trim() || fill(type.template, v.vars, d.purpose)).slice(0, 20000);
        if (content.includes("[texto a redigir")) throw new ActionError("Redija o texto da declaração antes de a enviar para assinatura.", 400);
        return save({ content, checks: JSON.stringify({ at: new Date().toISOString(), ownershipConfirmed: !!o.ownershipConfirmed, items: v.checks }) }, "Declaração preparada e revista — a aguardar assinatura.", "aguardando_assinatura");
      }
      case "sign": {
        requirePerm(sess, "declarations.sign");
        if (status !== "aguardando_assinatura") throw new ActionError("A declaração não está a aguardar assinatura.", 400);
        // a imagem de assinatura só é aplicada com a confirmação expressa do signatário
        if (o.confirm !== true) throw new ActionError("Confirme a assinatura do documento.", 400);
        const sig = await loadActiveSignatureImage(sess.userId);
        if (!sig) throw new ActionError("Carregue a sua assinatura em Administração → Assinatura electrónica.", 400);
        const prev = d.checks ? JSON.parse(d.checks) : {};
        const v = await verify(tx, d, type.requirement, !!prev.ownershipConfirmed);
        if (!v.ok) throw new ActionError(`Os requisitos deixaram de estar cumpridos: ${v.checks.filter((c) => !c.ok).map((c) => c.label).join("; ")}`, 422);
        const code = randomBytes(8).toString("hex").toUpperCase();
        const issuedAt = new Date();
        const verifyUrl = `${appUrl(req)}/verificar?codigo=${code}`;
        let pdf = await buildDeclarationPdf({
          number: d.number,
          typeName: type.name,
          fields: [
            ["Documento N.º", d.number],
            ["Nome", d.subjectName],
            ["Fracção", `${v.apt.block}-${v.apt.number}`],
            ["Bloco · Tipologia", `Bloco ${v.apt.block} · ${v.apt.typology}`],
            ["Morada do condomínio", ADDRESS],
            ["Finalidade", d.purpose || "Não indicada"],
            ["Data de emissão", formatLongDatePT(issuedAt.toISOString().slice(0, 10))],
            ["Responsável", `${sig.signature.displayName} — ${sig.signature.title}`],
          ],
          body: d.content ?? "",
          issuedAt,
          signer: { name: sig.signature.displayName, title: sig.signature.title, png: sig.png },
          verifyUrl,
          verificationCode: code,
        });
        pdf = await imageSignatureProvider.seal(pdf, { documentId: d.id, signerUserId: sess.userId });
        const saved = await saveFile(pdf, `${d.number}.pdf`, sess, d.residentId, { tx, category: "declaration", apartmentId: d.apartmentId });
        const out = await save(
          { signedByUserId: sess.userId, signerName: sig.signature.displayName, signerTitle: sig.signature.title, signedAt: issuedAt, signatureId: sig.signature.id, signatureProvider: imageSignatureProvider.id, pdfFileId: saved.id, pdfSha256: createHash("sha256").update(pdf).digest("hex"), verificationCode: code },
          `Assinada por ${sig.signature.displayName} e emitida (PDF ${saved.id}).`,
          "emitida",
        );
        if (d.residentId) await notify(tx, { title: `Declaração ${d.number} emitida`, body: `${type.name} — disponível para descarregar.`, roles: ["morador"], href: "/painel/declaracoes", residentId: d.residentId });
        return out;
      }
      case "reject": {
        requirePerm(sess, "declarations.manage");
        if (!["solicitada", "em_analise", "aguardando_assinatura"].includes(status)) throw new ActionError("Esta declaração já não pode ser rejeitada.", 400);
        if (!o.reason?.trim()) throw new ActionError("Indique o motivo da rejeição.", 400);
        const r = await save({ rejectionReason: o.reason.trim() }, `Rejeitada: ${o.reason.trim()}`, "rejeitada");
        if (d.residentId) await notify(tx, { title: `Declaração ${d.number} rejeitada`, body: o.reason.trim(), roles: ["morador"], href: "/painel/declaracoes", residentId: d.residentId });
        return r;
      }
      case "cancel": {
        if (!own && !staff) throw new ActionError("Sem permissão.", 403);
        if (own && !["solicitada", "em_analise"].includes(status)) throw new ActionError("O pedido já não pode ser cancelado.", 400);
        if (["emitida", "rejeitada", "cancelada", "anulada"].includes(status)) throw new ActionError("O pedido já está concluído.", 400);
        return save({}, `Cancelada${o.reason ? `: ${o.reason}` : ""}.`, "cancelada");
      }
      case "revoke": {
        requirePerm(sess, "declarations.sign");
        if (status !== "emitida") throw new ActionError("Só documentos emitidos podem ser anulados.", 400);
        if (!o.reason?.trim()) throw new ActionError("Indique o motivo da anulação.", 400);
        const r = await save({ revokedAt: new Date(), revokedBy: sess.name, revokeReason: o.reason.trim() }, `Documento anulado: ${o.reason.trim()}`, "anulada");
        if (d.residentId) await notify(tx, { title: `Declaração ${d.number} anulada`, body: o.reason.trim(), roles: ["morador"], href: "/painel/declaracoes", residentId: d.residentId });
        return r;
      }
    }
  });
}

/** Pré-visualização dos dados verificados (sem alterar o estado). */
export async function previewDeclaration(sess: Session, id: string, ownershipConfirmed = false) {
  requirePerm(sess, "declarations.manage");
  const d = await prisma.declaration.findUnique({ where: { id } });
  if (!d) throw new ActionError("Declaração inexistente.", 404);
  const type = await prisma.declarationType.findUnique({ where: { code: d.typeCode } });
  if (!type) throw new ActionError("Tipo inexistente.", 404);
  return prisma.$transaction(async (tx) => {
    const v = await verify(tx, d, type.requirement, ownershipConfirmed);
    return { checks: v.checks, ok: v.ok, suggested: d.content ?? fill(type.template, v.vars, d.purpose), account: { confirmedDebt: v.account.confirmedDebt, inValidation: v.account.inValidation, paidTotal: v.account.paidTotal } };
  });
}

/** Verificação pública (QR): confirma número, tipo, data e estado sem expor dados pessoais completos. */
export async function verifyByCode(code: string) {
  if (!/^[A-F0-9]{16}$/.test(code)) return null;
  const d = await prisma.declaration.findUnique({ where: { verificationCode: code } });
  if (!d) return null;
  const type = await prisma.declarationType.findUnique({ where: { code: d.typeCode } });
  const apt = await prisma.apartment.findUnique({ where: { id: d.apartmentId } });
  const initials = d.subjectName
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => `${p[0]}.`)
    .join(" ");
  return { number: d.number, type: type?.name ?? d.typeCode, status: d.status, signedAt: isoDate(d.signedAt), signer: d.signerName, signerTitle: d.signerTitle, fraction: apt ? `${apt.block}-${apt.number}` : null, holder: initials, revokedAt: isoDate(d.revokedAt), sha256: d.pdfSha256 };
}
