import type { Role } from "@/types";

/**
 * Permissões por OPERAÇÃO (não apenas por menu).
 * São verificadas nas páginas e nas acções do estado (src/store/demo-store.ts).
 * Na fase de backend, a mesma matriz deve ser aplicada no servidor.
 */
export type Permission =
  | "apartments.manage"
  | "residents.manage"
  | "quotas.manage"
  | "payments.review"
  | "payments.submit"
  | "notices.publish"
  | "circulars.issue"
  | "visits.create"
  | "visits.view_all"
  | "visits.check"
  | "occurrences.manage"
  | "documents.manage"
  | "settings.manage";

const MATRIX: Record<Permission, Role[]> = {
  "apartments.manage": ["admin_geral", "administrador"],
  "residents.manage": ["admin_geral", "administrador"],
  "quotas.manage": ["admin_geral", "administrador", "financeiro"],
  "payments.review": ["admin_geral", "administrador", "financeiro"],
  "payments.submit": ["morador"],
  "notices.publish": ["admin_geral", "administrador"],
  "circulars.issue": ["admin_geral", "administrador"],
  "visits.create": ["morador"],
  "visits.view_all": ["admin_geral", "administrador", "porteiro"],
  "visits.check": ["porteiro"],
  "occurrences.manage": ["admin_geral", "administrador"],
  "documents.manage": ["admin_geral", "administrador"],
  "settings.manage": ["admin_geral"],
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
