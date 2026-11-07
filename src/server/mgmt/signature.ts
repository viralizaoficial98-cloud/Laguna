/**
 * Assinatura do utilizador (imagem PNG privada) — apenas o próprio a pode ver ou utilizar.
 *
 * NOTA: a inserção de uma imagem de assinatura NÃO é uma assinatura digital qualificada. A interface
 * `SignatureProvider` prepara a integração futura com um prestador de assinatura electrónica (certificado
 * qualificado): o PDF é gerado e, num passo seguinte, enviado ao prestador para selagem.
 */
import type { Session } from "@/types";
import { prisma } from "../db";
import { ActionError } from "../errors";
import { saveFile, storageDir } from "../files";
import { auditLog, requirePerm, withWrite } from "./common";
import path from "node:path";
import { readFile } from "node:fs/promises";

export interface SignatureProvider {
  id: string;
  /** Recebe o PDF já com a imagem de assinatura e devolve o PDF final (ex.: selado por um prestador). */
  seal(pdf: Buffer, meta: { documentId: string; signerUserId: string }): Promise<Buffer>;
}

/** Fornecedor actual: imagem de assinatura inserida no PDF, sem selagem criptográfica. */
export const imageSignatureProvider: SignatureProvider = { id: "imagem", seal: async (pdf) => pdf };

function pngInfo(buf: Buffer) {
  if (buf.length < 33 || buf.subarray(1, 4).toString("latin1") !== "PNG") return null;
  const colorType = buf[25];
  const transparent = colorType === 4 || colorType === 6 || buf.includes(Buffer.from("tRNS", "latin1"));
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), transparent };
}

export async function getMySignature(sess: Session) {
  requirePerm(sess, "signature.manage");
  const [active, history, signed] = await Promise.all([
    prisma.signature.findFirst({ where: { userId: sess.userId, active: true } }),
    prisma.signature.findMany({ where: { userId: sess.userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.declaration.findMany({ where: { signedByUserId: sess.userId }, orderBy: { signedAt: "desc" }, take: 200 }),
  ]);
  return {
    active: active ? { id: active.id, fileId: active.fileId, displayName: active.displayName, title: active.title, createdAt: active.createdAt.toISOString() } : null,
    history: history.map((h) => ({ id: h.id, displayName: h.displayName, title: h.title, active: h.active, createdAt: h.createdAt.toISOString(), revokedAt: h.revokedAt?.toISOString() ?? null })),
    signed: signed.map((d) => ({ id: d.id, number: d.number, typeCode: d.typeCode, subjectName: d.subjectName, apartmentId: d.apartmentId, status: d.status, signedAt: d.signedAt?.toISOString() ?? null })),
    provider: imageSignatureProvider.id,
  };
}

export async function uploadSignature(sess: Session, buf: Buffer, name: string, displayName: string, title: string) {
  requirePerm(sess, "signature.manage");
  const info = pngInfo(buf);
  if (!info) throw new ActionError("A assinatura deve ser uma imagem PNG.", 415);
  if (info.width < 80 || info.height < 20) throw new ActionError("Imagem demasiado pequena.", 400);
  if (!displayName.trim() || !title.trim()) throw new ActionError("Indique o nome e o cargo a apresentar.", 400);
  return withWrite(async (tx) => {
    const saved = await saveFile(buf, name || "assinatura.png", sess, null, { tx, category: "signature" });
    await tx.signature.updateMany({ where: { userId: sess.userId, active: true }, data: { active: false, revokedAt: new Date() } });
    const sig = await tx.signature.create({ data: { id: `sig_${saved.id.slice(4)}`, userId: sess.userId, fileId: saved.id, displayName: displayName.trim().slice(0, 160), title: title.trim().slice(0, 160), active: true } });
    await auditLog(tx, sess, "Assinatura carregada", "signature", sig.id, `${sig.displayName} · ${sig.title}${info.transparent ? "" : " · sem transparência"}`);
    return { id: sig.id, transparent: info.transparent };
  }, { bump: false });
}

export async function updateSignatureLabels(sess: Session, displayName: string, title: string) {
  requirePerm(sess, "signature.manage");
  if (!displayName.trim() || !title.trim()) throw new ActionError("Indique o nome e o cargo.", 400);
  return withWrite(async (tx) => {
    const cur = await tx.signature.findFirst({ where: { userId: sess.userId, active: true } });
    if (!cur) throw new ActionError("Carregue primeiro a imagem da assinatura.", 400);
    await tx.signature.update({ where: { id: cur.id }, data: { displayName: displayName.trim(), title: title.trim() } });
    await auditLog(tx, sess, "Dados da assinatura alterados", "signature", cur.id, `${displayName.trim()} · ${title.trim()}`);
    return { ok: true };
  }, { bump: false });
}

export async function revokeSignature(sess: Session) {
  requirePerm(sess, "signature.manage");
  return withWrite(async (tx) => {
    const n = await tx.signature.updateMany({ where: { userId: sess.userId, active: true }, data: { active: false, revokedAt: new Date() } });
    await auditLog(tx, sess, "Assinatura revogada", "signature", sess.userId);
    return { revoked: n.count };
  }, { bump: false });
}

/** Imagem activa (uso interno do gerador de PDF — nunca exposta a outros utilizadores). */
export async function loadActiveSignatureImage(userId: string) {
  const sig = await prisma.signature.findFirst({ where: { userId, active: true } });
  if (!sig) return null;
  const f = await prisma.storedFile.findUnique({ where: { id: sig.fileId } });
  if (!f) return null;
  const data = await readFile(path.join(/* turbopackIgnore: true */ storageDir(), f.storagePath));
  return { signature: sig, png: data, info: pngInfo(data) };
}
