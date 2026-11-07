/** Consulta da auditoria (apenas leitura — não existe nenhuma operação de alteração ou eliminação). */
import type { Session } from "@/types";
import { prisma } from "../db";
import { requirePerm } from "./common";

export async function queryAudit(sess: Session, q: { source?: string; text?: string; from?: string; to?: string; take?: number }) {
  requirePerm(sess, "audit.view");
  const take = Math.min(Math.max(q.take ?? 200, 1), 1000);
  const at = { ...(q.from ? { gte: new Date(`${q.from}T00:00:00.000Z`) } : {}), ...(q.to ? { lt: new Date(new Date(`${q.to}T00:00:00.000Z`).getTime() + 86400_000) } : {}) };
  const text = q.text?.trim();
  const rows: { source: string; at: string; by: string; action: string; entity: string; details: string; ok?: boolean }[] = [];
  if (!q.source || q.source === "negocio") {
    const a = await prisma.auditEntry.findMany({ where: { at, ...(text ? { OR: [{ action: { contains: text } }, { details: { contains: text } }, { by: { contains: text } }, { entityId: { contains: text } }] } : {}) }, orderBy: { at: "desc" }, take });
    rows.push(...a.map((x) => ({ source: "negocio", at: x.at.toISOString(), by: `${x.by} (${x.role})`, action: x.action, entity: `${x.entity} ${x.entityId}`, details: x.details ?? "" })));
  }
  if (!q.source || q.source === "utilizadores") {
    const u = await prisma.userAuditLog.findMany({ where: { at, ...(text ? { OR: [{ action: { contains: text } }, { actorName: { contains: text } }, { targetName: { contains: text } }] } : {}) }, orderBy: { at: "desc" }, take });
    rows.push(...u.map((x) => ({ source: "utilizadores", at: x.at.toISOString(), by: x.actorName, action: x.action, entity: `utilizador ${x.targetName ?? x.targetId ?? ""}`, details: [x.before && `antes: ${x.before}`, x.after && `depois: ${x.after}`, x.ip && `IP ${x.ip}`].filter(Boolean).join(" · ") })));
  }
  if (!q.source || q.source === "operacoes") {
    const o = await prisma.actionLog.findMany({ where: { at, ...(text ? { OR: [{ action: { contains: text } }, { error: { contains: text } }, { userId: { contains: text } }] } : {}) }, orderBy: { at: "desc" }, take });
    const users = new Map((await prisma.user.findMany({ select: { id: true, name: true } })).map((x) => [x.id, x.name]));
    rows.push(...o.map((x) => ({ source: "operacoes", at: x.at.toISOString(), by: `${users.get(x.userId ?? "") ?? x.userId ?? "—"}${x.role ? ` (${x.role})` : ""}`, action: x.action, entity: `${x.changes} alteração(ões) · ${x.durationMs} ms`, details: x.error ?? "", ok: x.ok })));
  }
  if (!q.source || q.source === "importacoes") {
    const i = await prisma.importRun.findMany({ where: { at }, orderBy: { at: "desc" }, take: 50 });
    rows.push(...i.map((x) => ({ source: "importacoes", at: x.at.toISOString(), by: x.by, action: `Importação (${x.source})`, entity: x.mode, details: x.summary.slice(0, 600) })));
  }
  rows.sort((a, b) => b.at.localeCompare(a.at));
  return rows.slice(0, take);
}
