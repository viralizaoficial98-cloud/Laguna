/**
 * Gestão de Utilizadores (servidor).
 * - José Leiria (administrador): acesso total.
 * - Nelson Rodrigues (gestor): gere contas operacionais (gestor), de moradores e de portaria; não pode
 *   criar/alterar contas de administrador ou de gestor financeiro, nem elevar o próprio perfil.
 * Todas as alterações ficam no histórico (user_audit_log) — sem palavras-passe nem tokens.
 */
import type { Role } from "@/types";
import type { User, UserStatus } from "@/generated/prisma/client";
import { can } from "@/config/permissions";
import { prisma } from "./db";
import { ActionError } from "./errors";
import { issueToken, newId } from "./auth";
import type { Session } from "@/types";
import { acquireWriteLock, bumpVersion } from "./state";

const GESTOR_MANAGEABLE: Role[] = ["gestor", "morador", "porteiro"];
const ROLE_VALUES: Role[] = ["administrador", "gestor", "financeiro", "morador", "porteiro"];

export function canManageUsers(actor: Session) {
  return can(actor.role, "users.manage");
}

/** Pode o actor gerir esta conta (e atribuir este perfil)? */
export function assertCanManage(actor: Session, target: Pick<User, "id" | "role"> | null, newRole?: Role) {
  if (!canManageUsers(actor)) throw new ActionError("Sem permissão para gerir utilizadores.", 403);
  if (can(actor.role, "users.manage_privileged")) return;
  if (target && !GESTOR_MANAGEABLE.includes(target.role)) throw new ActionError("Apenas o Administrador pode alterar contas de administração ou do Gestor Financeiro.", 403);
  if (newRole && !GESTOR_MANAGEABLE.includes(newRole)) throw new ActionError("Não pode atribuir este perfil. Contacte o Administrador do Condomínio.", 403);
  if (target && target.id === actor.userId && newRole && newRole !== target.role) throw new ActionError("Não pode alterar o seu próprio perfil.", 403);
}

export function publicUser(u: User & { lastActivity?: Date | null }) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    title: u.title,
    status: u.status,
    residentId: u.residentId,
    apartmentId: u.apartmentId,
    block: u.block,
    phone: u.phone,
    hasPassword: !!u.passwordHash,
    lockedUntil: u.lockedUntil?.toISOString() ?? null,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    passwordChangedAt: u.passwordChangedAt?.toISOString() ?? null,
  };
}
export type PublicUser = ReturnType<typeof publicUser>;

const snapshot = (u: Partial<User>) => JSON.stringify({ name: u.name, email: u.email, role: u.role, title: u.title, status: u.status, apartmentId: u.apartmentId, block: u.block, residentId: u.residentId, phone: u.phone });

async function audit(actor: Session, target: Pick<User, "id" | "name"> | null, action: string, before?: string, after?: string, ip?: string | null) {
  await prisma.userAuditLog.create({ data: { actorId: actor.userId, actorName: actor.name, targetId: target?.id, targetName: target?.name, action, before, after, ip: ip ?? null } });
}

export async function listUsers(actor: Session) {
  if (!canManageUsers(actor)) throw new ActionError("Sem permissão para gerir utilizadores.", 403);
  const users = await prisma.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] });
  const pendingResets = await prisma.userAuditLog.findMany({ where: { action: "pedido_redefinicao", at: { gte: new Date(Date.now() - 7 * 86400_000) } }, orderBy: { at: "desc" }, take: 20 });
  const recentLogins = await prisma.loginAttempt.findMany({ orderBy: { at: "desc" }, take: 15 });
  const now = Date.now();
  const list = users.map(publicUser);
  return {
    users: list,
    stats: {
      total: list.length,
      active: list.filter((u) => u.status === "activo").length,
      inactive: list.filter((u) => u.status === "inactivo").length,
      blocked: list.filter((u) => u.status === "bloqueado" || (u.lockedUntil && new Date(u.lockedUntil).getTime() > now)).length,
      pending: list.filter((u) => u.status === "pendente_activacao").length,
      residents: list.filter((u) => u.role === "morador").length,
      byRole: ROLE_VALUES.map((r) => ({ role: r, count: list.filter((u) => u.role === r).length })),
    },
    recentLogins: recentLogins.map((l) => ({ email: l.email, success: l.success, reason: l.reason, at: l.at.toISOString(), ip: l.ip })),
    resetRequests: pendingResets.map((r) => ({ targetId: r.targetId, targetName: r.targetName, at: r.at.toISOString() })),
  };
}

export interface UserInput {
  name: string;
  email: string;
  role: Role;
  title?: string;
  apartmentId?: string | null;
  phone?: string | null;
}

function cleanInput(i: Partial<UserInput>) {
  const out: Partial<UserInput> = {};
  if (i.name !== undefined) {
    const n = String(i.name).trim();
    if (n.length < 2 || n.length > 160) throw new ActionError("Indique o nome (2 a 160 caracteres).", 400);
    out.name = n;
  }
  if (i.email !== undefined) {
    const e = String(i.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) || e.length > 190) throw new ActionError("Email inválido.", 400);
    out.email = e;
  }
  if (i.role !== undefined) {
    if (!ROLE_VALUES.includes(i.role)) throw new ActionError("Perfil inválido.", 400);
    out.role = i.role;
  }
  if (i.title !== undefined) out.title = String(i.title).trim().slice(0, 160);
  if (i.apartmentId !== undefined) out.apartmentId = i.apartmentId ? String(i.apartmentId) : null;
  if (i.phone !== undefined) out.phone = i.phone ? String(i.phone).trim().slice(0, 40) : null;
  return out;
}

const DEFAULT_TITLE: Record<Role, string> = {
  administrador: "Administrador do Condomínio",
  gestor: "Gestor Operacional",
  financeiro: "Gestor Financeiro do Condomínio",
  morador: "Morador",
  porteiro: "Portaria",
};

/**
 * Associa a conta de morador ao registo de morador da fracção. Se a fracção não tiver morador
 * registado, cria o registo (cadastro) e a ocupação, preservando o histórico.
 */
async function linkResident(name: string, email: string, phone: string | null | undefined, apartmentId: string, ignoreUserId?: string) {
  return prisma.$transaction(async (tx) => {
    await acquireWriteLock(tx);
    const apt = await tx.apartment.findUnique({ where: { id: apartmentId } });
    if (!apt || !apt.active) throw new ActionError("Apartamento inexistente ou desactivado.", 400);
    let residentId = apt.residentId ?? null;
    if (residentId) {
      const linked = await tx.user.findFirst({ where: { residentId, ...(ignoreUserId ? { id: { not: ignoreUserId } } : {}) } });
      if (linked) throw new ActionError(`O morador desta fracção já tem conta (${linked.email}).`, 409);
    } else {
      residentId = newId("res");
      const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
      await tx.resident.create({ data: { id: residentId, name, email, phone: phone ?? "", documentId: "", apartmentId, type: "proprietario", status: "activo", since: today, dependents: "[]", notes: "Registo criado na Gestão de Utilizadores." } });
      await tx.apartment.update({ where: { id: apartmentId }, data: { residentId, status: "ocupado" } });
      await tx.occupancy.create({ data: { id: `occ_${residentId}`, apartmentId, residentId, residentName: name, from: today } });
      await bumpVersion(tx);
    }
    return { residentId, block: apt.block, number: apt.number };
  });
}

export async function createUser(actor: Session, input: UserInput, ip: string | null) {
  const data = cleanInput(input) as UserInput;
  if (!data.name || !data.email || !data.role) throw new ActionError("Nome, email e perfil são obrigatórios.", 400);
  assertCanManage(actor, null, data.role);
  if (await prisma.user.findUnique({ where: { email: data.email } })) throw new ActionError("Já existe uma conta com este email.", 409);
  let residentId: string | null = null;
  let block: string | null = null;
  let title = data.title || DEFAULT_TITLE[data.role];
  if (data.role === "morador") {
    if (!data.apartmentId) throw new ActionError("Associe o morador a um apartamento.", 400);
    const r = await linkResident(data.name, data.email, data.phone, data.apartmentId);
    residentId = r.residentId;
    block = r.block;
    if (!data.title) title = `Morador · Bloco ${r.block} · ${r.number}`;
  } else if (data.apartmentId) {
    const apt = await prisma.apartment.findUnique({ where: { id: data.apartmentId } });
    block = apt?.block ?? null;
  }
  const user = await prisma.user.create({
    data: { id: newId("usr"), name: data.name, email: data.email, role: data.role, title, status: "pendente_activacao", residentId, apartmentId: data.apartmentId ?? null, block, phone: data.phone ?? null, createdBy: actor.userId },
  });
  await audit(actor, user, "conta_criada", undefined, snapshot(user), ip);
  return publicUser(user);
}

export async function updateUser(actor: Session, id: string, input: Partial<UserInput>, ip: string | null) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new ActionError("Utilizador inexistente.", 404);
  const data = cleanInput(input);
  assertCanManage(actor, target, data.role);
  if (data.email && data.email !== target.email && (await prisma.user.findUnique({ where: { email: data.email } }))) throw new ActionError("Já existe uma conta com este email.", 409);
  if (target.id === actor.userId && data.role && data.role !== target.role) throw new ActionError("Não pode alterar o seu próprio perfil.", 403);
  const role = data.role ?? target.role;
  const patch: Partial<User> = { name: data.name, email: data.email, role: data.role, title: data.title, phone: data.phone === undefined ? undefined : data.phone };
  if (data.apartmentId !== undefined && data.apartmentId !== target.apartmentId) {
    if (role === "morador" && data.apartmentId) {
      const r = await linkResident(data.name ?? target.name, data.email ?? target.email, data.phone ?? target.phone, data.apartmentId, target.id);
      Object.assign(patch, { apartmentId: data.apartmentId, residentId: r.residentId, block: r.block });
    } else {
      const apt = data.apartmentId ? await prisma.apartment.findUnique({ where: { id: data.apartmentId } }) : null;
      Object.assign(patch, { apartmentId: data.apartmentId, block: apt?.block ?? null, residentId: role === "morador" ? target.residentId : null });
    }
  }
  if (role !== "morador" && target.residentId && data.role) patch.residentId = null;
  const user = await prisma.user.update({ where: { id }, data: patch });
  // mudança de email ou de perfil invalida as sessões abertas
  if ((data.email && data.email !== target.email) || (data.role && data.role !== target.role)) await prisma.authSession.deleteMany({ where: { userId: id } });
  await audit(actor, user, "conta_editada", snapshot(target), snapshot(user), ip);
  return publicUser(user);
}

export type UserOp = "activate" | "deactivate" | "block" | "unlock" | "reset_link" | "activation_link" | "revoke_sessions";

export async function userOperation(actor: Session, id: string, op: UserOp, ip: string | null, base: string) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new ActionError("Utilizador inexistente.", 404);
  assertCanManage(actor, target);
  if (target.id === actor.userId && (op === "deactivate" || op === "block")) throw new ActionError("Não pode desactivar ou bloquear a sua própria conta.", 403);
  const setStatus = async (status: UserStatus, action: string, killSessions: boolean) => {
    const user = await prisma.user.update({ where: { id }, data: { status, ...(status === "activo" ? { failedLogins: 0, lockedUntil: null } : {}) } });
    if (killSessions) await prisma.authSession.deleteMany({ where: { userId: id } });
    await audit(actor, user, action, JSON.stringify({ status: target.status }), JSON.stringify({ status }), ip);
    return { user: publicUser(user) };
  };
  switch (op) {
    case "activate":
      if (!target.passwordHash) throw new ActionError("A conta ainda não tem palavra-passe definida — gere uma ligação de activação.", 400);
      return setStatus("activo", "conta_activada_gestao", false);
    case "deactivate":
      return setStatus("inactivo", "conta_desactivada", true);
    case "block":
      return setStatus("bloqueado", "conta_bloqueada", true);
    case "unlock": {
      const user = await prisma.user.update({ where: { id }, data: { failedLogins: 0, lockedUntil: null, status: target.status === "bloqueado" ? (target.passwordHash ? "activo" : "pendente_activacao") : target.status } });
      await audit(actor, user, "conta_desbloqueada", JSON.stringify({ status: target.status, lockedUntil: target.lockedUntil }), JSON.stringify({ status: user.status }), ip);
      return { user: publicUser(user) };
    }
    case "revoke_sessions": {
      const n = await prisma.authSession.deleteMany({ where: { userId: id } });
      await audit(actor, target, "sessoes_terminadas", undefined, JSON.stringify({ sessions: n.count }), ip);
      return { user: publicUser(target), sessions: n.count };
    }
    case "activation_link":
    case "reset_link": {
      const type = target.passwordHash ? "reset" : "activation";
      if (target.status === "inactivo" || target.status === "bloqueado") throw new ActionError("Active ou desbloqueie a conta antes de gerar a ligação.", 400);
      // ligações geradas pela gestão: 24 h (redefinição) / 72 h (activação)
      const t = await issueToken(id, type, actor.userId, type === "reset" ? 24 : 72);
      if (type === "reset") await prisma.authSession.deleteMany({ where: { userId: id } });
      const url = `${base}${t.path}`;
      const { sendMail, mailEnabled } = await import("./mailer");
      let emailed = false;
      if (mailEnabled()) {
        emailed = await sendMail(
          target.email,
          type === "reset" ? "Portal Residencial Laguna — redefinição de palavra-passe" : "Portal Residencial Laguna — activação da conta",
          `Olá ${target.name},\n\nPara ${type === "reset" ? "definir uma nova palavra-passe" : "activar a sua conta"} utilize a ligação (válida durante ${t.expiresHours} horas, utilização única):\n\n${url}\n\nSe não pediu esta operação, ignore este email e contacte a gestão do condomínio.`,
        ).catch(() => false);
      }
      await audit(actor, target, type === "reset" ? "redefinicao_iniciada" : "activacao_iniciada", undefined, JSON.stringify({ emailed, expiresHours: t.expiresHours }), ip);
      // a ligação só é devolvida quando não foi enviada por email (entrega administrativa segura)
      return { user: publicUser(target), emailed, link: emailed ? undefined : url, expiresHours: t.expiresHours, type };
    }
  }
}

export async function userHistory(actor: Session, id: string) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new ActionError("Utilizador inexistente.", 404);
  if (!canManageUsers(actor)) throw new ActionError("Sem permissão.", 403);
  const [changes, logins, sessions] = await Promise.all([
    prisma.userAuditLog.findMany({ where: { targetId: id }, orderBy: { at: "desc" }, take: 100 }),
    prisma.loginAttempt.findMany({ where: { OR: [{ userId: id }, { email: target.email }] }, orderBy: { at: "desc" }, take: 50 }),
    prisma.authSession.count({ where: { userId: id, expiresAt: { gt: new Date() } } }),
  ]);
  return {
    user: publicUser(target),
    activeSessions: sessions,
    changes: changes.map((c) => ({ at: c.at.toISOString(), actor: c.actorName, action: c.action, before: c.before, after: c.after })),
    logins: logins.map((l) => ({ at: l.at.toISOString(), success: l.success, reason: l.reason, ip: l.ip, userAgent: l.userAgent })),
  };
}
