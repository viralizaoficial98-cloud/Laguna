import type { Role } from "@/types";

/**
 * Contas INICIAIS do portal (cinco perfis), criadas na base de dados pelo script `npm run db:seed-users`.
 * Não têm palavra-passe: cada conta é activada por uma ligação de utilização única
 * (`npm run users:activation-link -- <email>` ou pela Gestão de Utilizadores).
 * Os emails são identificadores de acesso; a existência das caixas de correio deve ser confirmada.
 */
export interface InitialUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  residentId?: string;
}

export const initialUsers: InitialUser[] = [
  { id: "usr_jose_leiria", name: "José Leiria", email: "jose.leiria@residenciallaguna.ao", role: "administrador", title: "Administrador do Condomínio" },
  { id: "usr_nelson_rodrigues", name: "Nelson Rodrigues", email: "nelson.rodrigues@residenciallaguna.ao", role: "gestor", title: "Gestor Operacional" },
  { id: "usr_saraiva", name: "Saraiva", email: "saraiva@residenciallaguna.ao", role: "financeiro", title: "Gestor Financeiro do Condomínio" },
  { id: "usr_manuel_muenho", name: "Manuel Muenho", email: "manuel.muenho@residenciallaguna.ao", role: "morador", title: "Morador · Bloco 06 · 201", residentId: "res_demo" },
  { id: "usr_portaria", name: "Portaria Laguna", email: "portaria@residenciallaguna.ao", role: "porteiro", title: "Portaria — Entrada principal" },
];

export const roleLabels: Record<Role, string> = {
  administrador: "Administrador do Condomínio",
  gestor: "Gestor Operacional",
  financeiro: "Gestor Financeiro",
  morador: "Morador",
  porteiro: "Portaria",
};

export const roleDescriptions: Record<Role, string> = {
  administrador: "Gestão executiva, financeira e administrativa; supervisão operacional",
  gestor: "Elevadores, ocorrências, limpeza, jardinagem, manutenção, fiscalização, validação de comprovativos e vistorias",
  financeiro: "Receitas, cobranças, comprovativos, despesas, recibos, extractos, reservas e verificação financeira",
  morador: "Quotas trimestrais, comprovativos, reservas de salões, visitas, ocorrências e desocupação",
  porteiro: "Visitantes autorizados, eventos em salões e autorizações de saída",
};

export const ROLES: Role[] = ["administrador", "gestor", "financeiro", "morador", "porteiro"];
