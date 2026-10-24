/**
 * Autenticação: palavras-passe Argon2id, sessões em cookie httpOnly (token aleatório; na base de
 * dados só fica o SHA-256), bloqueio por tentativas falhadas, tokens de activação/redefinição de
 * utilização única e com prazo.
 */
import { createHash, randomBytes } from "node:crypto";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import type { Session } from "@/types";
import type { User } from "@/generated/prisma/client";
import { prisma } from "./db";
import { ActionError } from "./errors";

export const SESSION_COOKIE = "laguna_session";
const SESSION_HOURS = Number(process.env.SESSION_HOURS ?? 12);
const IDLE_MINUTES = Number(process.env.SESSION_IDLE_MINUTES ?? 120);
export const MAX_FAILED = 5;
export const LOCK_MINUTES = 15;
const IP_WINDOW_MAX = 30;

// algorithm 2 = Argon2id (parâmetros recomendados OWASP: 19 MiB, 2 iterações)
const ARGON = { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
// hash fictício para igualar o tempo de resposta quando o email não existe
let dummyHash: string | null = null;

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const newId = (prefix: string) => `${prefix}_${randomBytes(9).toString("base64url")}`;

export async function hashPassword(pw: string) {
  return argonHash(pw, ARGON);
}

export async function verifyPassword(hash: string, pw: string) {
  try {
    return await argonVerify(hash, pw);
  } catch {
    return false;
  }
}

/** Política mínima: 10 caracteres, letras e números, diferente do email. */
export function passwordProblem(pw: string, email?: string): string | null {
  if (typeof pw !== "string" || pw.length < 10) return "A palavra-passe deve ter pelo menos 10 caracteres.";
  if (pw.length > 128) return "A palavra-passe é demasiado longa.";
  if (!/[A-Za-zÀ-ÿ]/.test(pw) || !/\d/.test(pw)) return "A palavra-passe deve conter letras e números.";
  if (email && pw.toLowerCase().includes(email.split("@")[0].toLowerCase())) return "A palavra-passe não pode conter o seu email.";
  return null;
}

export function toSession(u: Pick<User, "id" | "name" | "email" | "role" | "title" | "residentId">, startedAt: Date): Session {
  return { userId: u.id, name: u.name, email: u.email, role: u.role, title: u.title, residentId: u.residentId ?? undefined, startedAt: startedAt.toISOString() };
}

export function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "").trim().slice(0, 64) || null;
}

export function cookieOptions(maxAgeSeconds: number) {
  const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : (process.env.APP_URL ?? "").startsWith("https://");
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge: maxAgeSeconds };
}

export async function createSession(userId: string, req: Request) {
  const token = randomToken();
  const now = new Date();
  await prisma.authSession.create({
    data: {
      id: newId("ses"),
      tokenHash: sha256(token),
      userId,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + SESSION_HOURS * 3600_000),
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent")?.slice(0, 255) ?? null,
    },
  });
  return { token, maxAge: SESSION_HOURS * 3600 };
}

function readCookie(req: Request, name: string) {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

/** Sessão válida do pedido (ou null). Renova a última actividade no máximo uma vez por minuto. */
export async function getSession(req: Request): Promise<{ session: Session; user: User; sessionId: string } | null> {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token || token.length > 200) return null;
  const s = await prisma.authSession.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!s) return null;
  const now = Date.now();
  const idleExpired = now - s.lastSeenAt.getTime() > IDLE_MINUTES * 60_000;
  if (s.expiresAt.getTime() < now || idleExpired || s.user.status !== "activo") {
    await prisma.authSession.delete({ where: { id: s.id } }).catch(() => undefined);
    return null;
  }
  if (now - s.lastSeenAt.getTime() > 60_000) await prisma.authSession.update({ where: { id: s.id }, data: { lastSeenAt: new Date(now) } }).catch(() => undefined);
  return { session: toSession(s.user, s.createdAt), user: s.user, sessionId: s.id };
}

export async function requireSession(req: Request) {
  const s = await getSession(req);
  if (!s) throw new ActionError("Sessão inválida ou expirada. Inicie sessão novamente.", 401);
  return s;
}

/** Protecção CSRF: pedidos de escrita têm de vir da mesma origem. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // navegadores enviam sempre Origin em POST; ferramentas internas não
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new ActionError("Origem do pedido não autorizada.", 403);
  } catch (e) {
    if (e instanceof ActionError) throw e;
    throw new ActionError("Origem do pedido não autorizada.", 403);
  }
}

export type LoginResult = { ok: true; user: User } | { ok: false; status: number; error: string };

const GENERIC = "Email ou palavra-passe inválidos.";

export async function attemptLogin(emailRaw: string, password: string, req: Request): Promise<LoginResult> {
  const email = String(emailRaw ?? "").trim().toLowerCase().slice(0, 190);
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent")?.slice(0, 255) ?? null;
  const since = new Date(Date.now() - LOCK_MINUTES * 60_000);
  const record = (userId: string | null, success: boolean, reason?: string) => prisma.loginAttempt.create({ data: { email, userId, ip, userAgent: ua, success, reason } });

  if (ip) {
    const ipFails = await prisma.loginAttempt.count({ where: { ip, success: false, at: { gte: since } } });
    if (ipFails >= IP_WINDOW_MAX) {
      await record(null, false, "limite_ip");
      return { ok: false, status: 429, error: `Demasiadas tentativas a partir deste endereço. Aguarde ${LOCK_MINUTES} minutos.` };
    }
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    dummyHash ??= await hashPassword(randomToken(12));
    await verifyPassword(dummyHash, String(password ?? ""));
    await record(user?.id ?? null, false, user ? "conta_nao_activada" : "email_desconhecido");
    return { ok: false, status: 401, error: user && user.status === "pendente_activacao" ? "Conta ainda não activada. Utilize a ligação de activação recebida." : GENERIC };
  }
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await record(user.id, false, "bloqueio_temporario");
    return { ok: false, status: 423, error: `Conta temporariamente bloqueada por tentativas falhadas. Tente novamente após ${user.lockedUntil.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Luanda" })}.` };
  }
  const valid = await verifyPassword(user.passwordHash, String(password ?? ""));
  if (!valid) {
    const failed = user.failedLogins + 1;
    const lock = failed >= MAX_FAILED;
    await prisma.user.update({ where: { id: user.id }, data: { failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : user.lockedUntil } });
    await record(user.id, false, lock ? "palavra_passe_errada_bloqueio" : "palavra_passe_errada");
    if (lock) await prisma.userAuditLog.create({ data: { actorName: "Sistema", targetId: user.id, targetName: user.name, action: "bloqueio_temporario", after: JSON.stringify({ lockedMinutes: LOCK_MINUTES }), ip } });
    return { ok: false, status: 401, error: GENERIC };
  }
  if (user.status !== "activo") {
    await record(user.id, false, `conta_${user.status}`);
    return { ok: false, status: 403, error: user.status === "bloqueado" ? "Conta bloqueada. Contacte a gestão do condomínio." : "Conta inactiva. Contacte a gestão do condomínio." };
  }
  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await record(user.id, true);
  return { ok: true, user };
}

// ————— tokens de activação / redefinição —————

export type TokenType = "activation" | "reset";
export const TOKEN_TTL_HOURS: Record<TokenType, number> = { activation: 72, reset: 2 };

export function appUrl(req?: Request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (req) return new URL(req.url).origin;
  return "http://localhost:3000";
}

export async function issueToken(userId: string, type: TokenType, createdBy: string | null, ttlHours = TOKEN_TTL_HOURS[type]) {
  const token = randomToken();
  // apenas o último token de cada tipo permanece válido
  await prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.authToken.create({ data: { id: newId("tok"), tokenHash: sha256(token), userId, type, expiresAt: new Date(Date.now() + ttlHours * 3600_000), createdBy } });
  return { token, path: `/${type === "activation" ? "activar" : "redefinir"}?token=${encodeURIComponent(token)}`, expiresHours: ttlHours };
}

export async function inspectToken(token: string) {
  if (!token || token.length > 200) return null;
  const t = await prisma.authToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!t || t.usedAt || t.expiresAt.getTime() < Date.now()) return null;
  return t;
}

/** Define a palavra-passe a partir de um token (activação ou redefinição) e invalida as sessões. */
export async function consumeToken(token: string, password: string, ip: string | null) {
  const t = await inspectToken(token);
  if (!t) throw new ActionError("Ligação inválida ou expirada. Peça uma nova ligação à gestão do condomínio.", 400);
  if (t.user.status === "inactivo" || t.user.status === "bloqueado") throw new ActionError("Conta inactiva ou bloqueada. Contacte a gestão do condomínio.", 403);
  const problem = passwordProblem(password, t.user.email);
  if (problem) throw new ActionError(problem, 400);
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    // utilização única garantida pela condição usedAt = null
    const used = await tx.authToken.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count !== 1) throw new ActionError("Ligação já utilizada.", 400);
    await tx.user.update({
      where: { id: t.userId },
      data: { passwordHash, passwordChangedAt: new Date(), failedLogins: 0, lockedUntil: null, status: t.user.status === "pendente_activacao" ? "activo" : t.user.status },
    });
    await tx.authSession.deleteMany({ where: { userId: t.userId } });
    await tx.userAuditLog.create({
      data: { actorId: t.userId, actorName: t.user.name, targetId: t.userId, targetName: t.user.name, action: t.type === "activation" ? "conta_activada" : "palavra_passe_redefinida", ip },
    });
  });
  return t.user;
}
