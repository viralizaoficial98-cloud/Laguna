/**
 * Armazenamento de anexos fora da pasta pública (STORAGE_DIR). Os ficheiros são servidos apenas
 * através de /api/files/:id após verificação da sessão e do perfil.
 */
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Session } from "@/types";
import { prisma } from "./db";
import { ActionError } from "./errors";

export const MAX_FILE_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 5) * 1024 * 1024;
export const ALLOWED_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function storageDir() {
  return path.resolve(/* turbopackIgnore: true */ process.env.STORAGE_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), "storage"));
}

/** Verifica a assinatura do ficheiro (não confia apenas no tipo declarado). */
function sniff(buf: Buffer): string | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString("latin1") === "PNG") return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

export async function saveFile(buf: Buffer, originalName: string, owner: Session | null, residentId?: string | null) {
  if (buf.length === 0) throw new ActionError("Ficheiro vazio.", 400);
  if (buf.length > MAX_FILE_BYTES) throw new ActionError(`O ficheiro excede ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.`, 413);
  const mime = sniff(buf);
  if (!mime || !ALLOWED_MIME[mime]) throw new ActionError("Formato não suportado. Utilize PDF, JPG, PNG ou WEBP.", 415);
  const id = `fil_${randomBytes(12).toString("base64url")}`;
  const sub = new Date().toISOString().slice(0, 7);
  const rel = path.join(sub, `${id}.${ALLOWED_MIME[mime]}`);
  const abs = path.join(storageDir(), rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buf, { mode: 0o640 });
  const name = path.basename(originalName || "ficheiro").replace(/[^\p{L}\p{N}._ -]+/gu, "_").slice(0, 200) || "ficheiro";
  await prisma.storedFile.create({
    data: { id, originalName: name, mime, size: buf.length, sha256: createHash("sha256").update(buf).digest("hex"), storagePath: rel, ownerUserId: owner?.userId ?? null, ownerRole: owner?.role ?? null, residentId: residentId ?? owner?.residentId ?? null },
  });
  return { id, name, mime, size: buf.length };
}

/**
 * Regra de acesso: a gestão (administrador, gestor, financeiro) acede a todos os anexos; o autor do
 * envio acede aos seus; o morador acede ainda aos PDFs de comunicados publicados e aos documentos
 * visíveis para moradores. A Portaria não acede a anexos.
 */
export async function readAuthorized(id: string, sess: Session) {
  const f = await prisma.storedFile.findUnique({ where: { id } });
  if (!f) throw new ActionError("Ficheiro inexistente.", 404);
  const staff = sess.role === "administrador" || sess.role === "gestor" || sess.role === "financeiro";
  const own = f.ownerUserId === sess.userId;
  let published = false;
  if (!staff && !own && sess.role === "morador") {
    const [notice, doc] = await Promise.all([
      prisma.notice.count({ where: { status: "publicado", pdf: { contains: `"${id}"` } } }),
      prisma.condoDocument.count({ where: { visibility: { in: ["publico", "moradores"] }, file: { contains: `"${id}"` } } }),
    ]);
    published = notice + doc > 0;
  }
  const ownResident = sess.role === "morador" && !!sess.residentId && f.residentId === sess.residentId;
  if (!staff && !own && !published && !ownResident) throw new ActionError("Sem permissão para este ficheiro.", 403);
  const abs = path.join(/* turbopackIgnore: true */ storageDir(), f.storagePath);
  if (!abs.startsWith(storageDir())) throw new ActionError("Caminho inválido.", 400);
  const data = await readFile(abs).catch(() => {
    throw new ActionError("O ficheiro não está disponível no armazenamento.", 410);
  });
  return { file: f, data };
}
