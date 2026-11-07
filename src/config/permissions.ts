import type { Role } from "@/types";

/**
 * Permissões por OPERAÇÃO (não apenas por menu).
 * São verificadas nas páginas, nas acções do motor de domínio (src/domain/engine.ts) e no servidor,
 * que executa todas as acções com a sessão autenticada (src/server/actions.ts).
 *
 *  - administrador → José Leiria (Administrador do Condomínio): gestão executiva e supervisão
 *  - gestor        → Nelson Rodrigues (Gestor Operacional): centro de gestão do condomínio — operações, cadastro,
 *                    finanças, despesas, orçamento, documentos, declarações e assinatura (excepto contas de
 *                    administração/Gestor Financeiro e eliminação de auditoria, que não existe para ninguém)
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
  | "data.import"
  | "holders.manage"
  | "suppliers.manage"
  | "budget.view"
  | "budget.manage"
  | "revenues.manage"
  | "declarations.request"
  | "declarations.manage"
  | "declarations.sign"
  | "signature.manage"
  | "audit.view";

/**
 * Matriz (secção 7 do pedido):
 *  administrador = José Leiria · gestor = Nelson Rodrigues · financeiro = Saraiva · morador · porteiro
 */
const MATRIX: Record<Permission, Role[]> = {
  "executive.view": ["administrador", "gestor"],
  "finance.view": ["administrador", "financeiro", "gestor"],
  "finance.limited": ["administrador", "financeiro", "gestor"],
  "reports.executive": ["administrador", "gestor"],
  "reports.financial": ["administrador", "financeiro", "gestor"],
  "reports.financial_limited": ["administrador", "financeiro", "gestor"],
  "reports.operational": ["administrador", "gestor"],
  "apartments.manage": ["administrador", "gestor"],
  "residents.manage": ["administrador", "gestor"],
  "residents.view": ["administrador", "gestor", "financeiro"],
  "quotas.manage": ["administrador", "financeiro", "gestor"],
  "payments.review": ["administrador", "gestor", "financeiro"],
  "payments.register": ["administrador", "financeiro", "gestor"],
  "payments.submit": ["morador"],
  "receipts.issue": ["administrador", "financeiro", "gestor"],
  "accounts.view": ["administrador", "financeiro", "gestor"],
  "expenses.manage": ["financeiro", "gestor"],
  "expenses.view": ["administrador", "financeiro", "gestor"],
  "notices.publish": ["administrador", "gestor"],
  "notices.view": ["administrador", "gestor", "financeiro", "morador"],
  "circulars.issue": ["administrador", "gestor"],
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
  "halls.manage": ["administrador", "gestor"],
  "reservations.request": ["morador"],
  "reservations.validate": ["financeiro", "gestor"],
  "reservations.view_all": ["administrador", "gestor", "financeiro"],
  "reservations.events": ["porteiro", "administrador", "gestor"],
  "moveout.request": ["morador"],
  "moveout.view_all": ["administrador", "gestor", "financeiro"],
  "moveout.financial": ["financeiro", "gestor"],
  "moveout.operational": ["gestor"],
  "moveout.authorize": ["gestor", "financeiro"],
  "moveout.complete": ["administrador", "gestor", "financeiro"],
  "moveout.authorized_view": ["porteiro"],
  "charges.propose": ["gestor", "financeiro"],
  "charges.confirm": ["administrador", "gestor"],
  "documents.manage": ["administrador", "gestor"],
  "settings.manage": ["administrador", "gestor"],
  // Gestão de Utilizadores: Nelson gere contas operacionais, de moradores e de portaria; José gere todas
  "users.manage": ["administrador", "gestor"],
  "users.manage_privileged": ["administrador"],
  "data.import": ["administrador", "gestor"],
  // proprietários e inquilinos (titularidade separada da residência)
  "holders.manage": ["administrador", "gestor"],
  "suppliers.manage": ["administrador", "gestor", "financeiro"],
  "budget.view": ["administrador", "gestor", "financeiro"],
  "budget.manage": ["administrador", "gestor", "financeiro"],
  "revenues.manage": ["administrador", "gestor", "financeiro"],
  // declarações do condomínio: o morador pede; a gestão analisa, assina e emite
  "declarations.request": ["morador"],
  "declarations.manage": ["administrador", "gestor"],
  "declarations.sign": ["administrador", "gestor"],
  "signature.manage": ["administrador", "gestor"],
  // auditoria: consulta apenas — não existe operação de eliminação para nenhum perfil
  "audit.view": ["administrador", "gestor"],
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
