import type { Role } from "@/types";

/**
 * Permissões por OPERAÇÃO (não apenas por menu).
 * São verificadas nas páginas e nas acções do estado (src/store/demo-store.ts).
 * Na fase de backend, a mesma matriz deve ser aplicada no servidor.
 *
 *  - administrador → José Leiria (Administrador do Condomínio): gestão executiva e financeira, supervisão operacional
 *  - gestor        → Nelson Rodrigues (Gestor Operacional): elevadores, ocorrências, limpeza, jardinagem, manutenção
 *  - morador       → próprias quotas, comprovativos, visitas e ocorrências
 *  - porteiro      → controlo de entradas e saídas de visitantes
 */
export type Permission =
  | "executive.view"
  | "finance.view"
  | "reports.executive"
  | "reports.operational"
  | "apartments.manage"
  | "residents.manage"
  | "residents.view"
  | "quotas.manage"
  | "payments.review"
  | "payments.submit"
  | "notices.publish"
  | "notices.view"
  | "circulars.issue"
  | "circulars.view_all"
  | "visits.create"
  | "visits.view_all"
  | "visits.check"
  | "occurrences.manage"
  | "occurrences.supervise"
  | "occurrences.report"
  | "elevators.manage"
  | "elevators.view"
  | "operations.manage"
  | "operations.view"
  | "documents.manage"
  | "settings.manage";

const MATRIX: Record<Permission, Role[]> = {
  "executive.view": ["administrador"],
  "finance.view": ["administrador"],
  "reports.executive": ["administrador"],
  "reports.operational": ["administrador", "gestor"],
  "apartments.manage": ["administrador"],
  "residents.manage": ["administrador"],
  "residents.view": ["administrador", "gestor"],
  "quotas.manage": ["administrador"],
  "payments.review": ["administrador"],
  "payments.submit": ["morador"],
  "notices.publish": ["administrador"],
  "notices.view": ["administrador", "gestor", "morador"],
  "circulars.issue": ["administrador"],
  "circulars.view_all": ["administrador", "gestor"],
  "visits.create": ["morador"],
  "visits.view_all": ["administrador", "gestor", "porteiro"],
  "visits.check": ["porteiro"],
  "occurrences.manage": ["gestor"],
  "occurrences.supervise": ["administrador", "gestor"],
  "occurrences.report": ["morador", "gestor"],
  "elevators.manage": ["gestor"],
  "elevators.view": ["administrador", "gestor", "morador"],
  "operations.manage": ["gestor"],
  "operations.view": ["administrador", "gestor"],
  "documents.manage": ["administrador"],
  "settings.manage": ["administrador"],
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
