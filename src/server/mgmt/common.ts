/**
 * Utilitários dos módulos de gestão (fracções, titulares, declarações, orçamento, receitas, importação Excel):
 * transacção com o trinco de escrita, auditoria de negócio inalterável e notificações.
 */
import { randomBytes } from "node:crypto";
import type { Role, Session } from "@/types";
import { can, type Permission } from "@/config/permissions";
import { prisma, type Tx } from "../db";
import { ActionError } from "../errors";
import { acquireWriteLock, bumpVersion, isTransientConflict } from "../state";

export const mid = (prefix: string) => `${prefix}_${randomBytes(9).toString("base64url")}`;

export function requirePerm(sess: Session, p: Permission) {
  if (!can(sess.role, p)) throw new ActionError("Operação não autorizada para o seu perfil.", 403);
}

/** Transacção com trinco de escrita; incrementa a versão dos dados para os outros dispositivos se actualizarem. */
export async function withWrite<T>(fn: (tx: Tx) => Promise<T>, opts: { bump?: boolean; timeout?: number } = {}): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await acquireWriteLock(tx);
          const r = await fn(tx);
          if (opts.bump !== false) await bumpVersion(tx);
          return r;
        },
        { maxWait: 15_000, timeout: opts.timeout ?? 60_000 },
      );
    } catch (e) {
      if (i >= 3 || !isTransientConflict(e)) throw e;
      await new Promise((r) => setTimeout(r, 60 * (i + 1)));
    }
  }
}

/** Registo de auditoria de negócio (tabela audit_entries — não existe operação de eliminação). */
export async function auditLog(tx: Tx, sess: Session | { name: string; role: Role }, action: string, entity: string, entityId: string, details?: string) {
  await tx.auditEntry.create({
    data: { id: mid("aud"), at: new Date(), by: sess.name, role: sess.role, action: action.slice(0, 120), entity: entity.slice(0, 40), entityId: entityId.slice(0, 80), details: details?.slice(0, 4000) },
  });
}

export async function notify(tx: Tx, n: { title: string; body: string; roles: Role[]; href?: string; residentId?: string | null }) {
  await tx.notification.create({
    data: { id: mid("ntf"), title: n.title.slice(0, 255), body: n.body, at: new Date(), read: false, roles: JSON.stringify(n.roles), href: n.href ?? null, residentId: n.residentId ?? null },
  });
}

export const isoDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
export const toDateOnly = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new ActionError("Data inválida (AAAA-MM-DD).", 400);
  return new Date(`${s}T00:00:00.000Z`);
};
export const money = (v: unknown) => Math.round(Number(String(v ?? 0)) * 100) / 100;
export const periodOf = (dateIso: string) => `${dateIso.slice(0, 4)}-T${Math.floor((Number(dateIso.slice(5, 7)) - 1) / 3) + 1}`;

/** Nome normalizado para conciliação (sem acentos, pontuação, espaços e maiúsculas). */
export function normalizeName(s: string | null | undefined) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Limpa espaços e quebras de linha preservando o texto. */
export const cleanText = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

const tokens = (s: string) =>
  new Set(
    String(s ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1 && !["lda", "sa", "s", "a", "de", "da", "do", "dos", "das", "e"].includes(t)),
  );

function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Semelhança entre dois nomes (possível duplicado a validar — nunca fundido automaticamente). */
export function similarNames(a: string, b: string) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb || na === nb) return false;
  if (na.length > 5 && nb.length > 5 && (na.startsWith(nb) || nb.startsWith(na))) return true;
  // grafias próximas (ex.: "Ethan e Haniel" / "Hethan e Haniel, Lda")
  const strip = (x: string) => x.replace(/(lda|limitada|sa|sarl)$/, "");
  if (Math.min(na.length, nb.length) > 7 && levenshtein(strip(na), strip(nb)) <= 2) return true;
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return false;
  const inter = [...ta].filter((t) => tb.has(t)).length;
  const small = Math.min(ta.size, tb.size);
  return inter >= 2 && inter === small;
}
