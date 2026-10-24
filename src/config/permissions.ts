import type { Role } from "@/types";

/**
 * Permissões por OPERAÇÃO (não apenas por menu).
 * São verificadas nas páginas, nas acções do motor de domínio (src/domain/engine.ts) e no servidor,
 * que executa todas as acções com a sessão autenticada (src/server/actions.ts).
 *
 *  - administrador → José Leiria (Administrador do Condomínio): gestão executiva e supervisão
 *  - gestor        → Nelson Rodrigues (Gestor Operacional): operações e validação de comprovativos
 *  - financeiro    → Saraiva (Gestor Financeiro): finanças, cobranças, despesas, reservas e verificação financeira
 *  - morador       → próprias quotas, comprovativos, visitas e ocorrências
 *  - porteiro      → controlo de entradas e saídas de visitantes
 */
export type Permission =
  | "executive.view"
  | "finance.view"
  | "finance.limited"
  | "reports.executive"
  | "reports.financial"
  | "reports.financial_limited"
  | "reports.operational"
  | "apartments.manage"
  | "residents.manage"
  | "residents.view"
  | "quotas.manage"
  | "payments.review"
  | "payments.register"
  | "payments.submit"
  | "receipts.issue"
  | "accounts.view"
  | "expenses.manage"
  | "expenses.view"
  | "notices.publish"
  | "notices.view"
  | "circulars.issue"
  | "circulars.view_all"
  | "visits.create"
  | "visits.view_all"
  | "visits.check"
  | "occurrences.manage"
  | "occurrences.supervise"
  | "occurrences.view"
  | "occurrences.report"
  | "elevators.manage"
  | "elevators.view"
  | "operations.manage"
  | "operations.view"
  | "halls.manage"
  | "reservations.request"
  | "reservations.validate"
  | "reservations.view_all"
  | "reservations.events"
  | "moveout.request"
  | "moveout.view_all"
  | "moveout.financial"
  | "moveout.operational"
  | "moveout.authorize"
  | "moveout.complete"
  | "moveout.authorized_view"
  | "charges.propose"
  | "charges.confirm"
  | "documents.manage"
  | "settings.manage"
  | "users.manage"
  | "users.manage_privileged"
  | "data.import";

/**
 * Matriz (secção 7 do pedido):
 *  administrador = José Leiria · gestor = Nelson Rodrigues · financeiro = Saraiva · morador · porteiro
 */
const MATRIX: Record<Permission, Role[]> = {
  "executive.view": ["administrador"],
  "finance.view": ["administrador", "financeiro"],
  "finance.limited": ["administrador", "financeiro", "gestor"],
  "reports.executive": ["administrador"],
  "reports.financial": ["administrador", "financeiro"],
  "reports.financial_limited": ["administrador", "financeiro", "gestor"],
  "reports.operational": ["administrador", "gestor"],
  "apartments.manage": ["administrador"],
  "residents.manage": ["administrador"],
  "residents.view": ["administrador", "gestor", "financeiro"],
  "quotas.manage": ["administrador", "financeiro"],
  "payments.review": ["administrador", "gestor", "financeiro"],
  "payments.register": ["administrador", "financeiro"],
  "payments.submit": ["morador"],
  "receipts.issue": ["administrador", "financeiro"],
  "accounts.view": ["administrador", "financeiro"],
  "expenses.manage": ["financeiro"],
  "expenses.view": ["administrador", "financeiro"],
  "notices.publish": ["administrador"],
  "notices.view": ["administrador", "gestor", "financeiro", "morador"],
  "circulars.issue": ["administrador"],
  "circulars.view_all": ["administrador", "gestor", "financeiro"],
  "visits.create": ["morador"],
  "visits.view_all": ["administrador", "gestor", "porteiro"],
  "visits.check": ["porteiro"],
  "occurrences.manage": ["gestor"],
  "occurrences.supervise": ["administrador", "gestor"],
  "occurrences.view": ["administrador", "gestor", "financeiro"],
  "occurrences.report": ["morador", "gestor"],
  "elevators.manage": ["gestor"],
  "elevators.view": ["administrador", "gestor", "morador"],
  "operations.manage": ["gestor"],
  "operations.view": ["administrador", "gestor"],
  "halls.manage": ["administrador"],
  "reservations.request": ["morador"],
  "reservations.validate": ["financeiro"],
  "reservations.view_all": ["administrador", "gestor", "financeiro"],
  "reservations.events": ["porteiro", "administrador", "gestor"],
  "moveout.request": ["morador"],
  "moveout.view_all": ["administrador", "gestor", "financeiro"],
  "moveout.financial": ["financeiro"],
  "moveout.operational": ["gestor"],
  "moveout.authorize": ["gestor", "financeiro"],
  "moveout.complete": ["administrador", "gestor", "financeiro"],
  "moveout.authorized_view": ["porteiro"],
  "charges.propose": ["gestor", "financeiro"],
  "charges.confirm": ["administrador"],
  "documents.manage": ["administrador"],
  "settings.manage": ["administrador"],
  // Gestão de Utilizadores: Nelson gere contas operacionais, de moradores e de portaria; José gere todas
  "users.manage": ["administrador", "gestor"],
  "users.manage_privileged": ["administrador"],
  "data.import": ["administrador"],
};

export function can(role: Role | undefined | null, permission: Permission) {
  return !!role && MATRIX[permission].includes(role);
}

export class PermissionError extends Error {
  constructor(permission: Permission) {
    super(`Operação não autorizada para este perfil (${permission}).`);
    this.name = "PermissionError";
  }
}

export const permissionMatrix = MATRIX;
