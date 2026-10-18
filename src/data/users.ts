import type { DemoUser, Role } from "@/types";

/**
 * Utilizadores do LOGIN DEMONSTRATIVO.
 * Credenciais exclusivamente para testes — não utilizar em produção.
 * Na fase de backend, esta lista será substituída por autenticação real
 * (palavras-passe com hash, sessões no servidor).
 */
export const DEMO_PASSWORD = "DemoLaguna2026";

export const demoUsers: DemoUser[] = [
  {
    id: "usr_admin_geral",
    name: "Helena Cardoso",
    email: "admin@laguna.demo",
    password: DEMO_PASSWORD,
    role: "admin_geral",
    title: "Administradora Geral",
    status: "activo",
    lastAccess: "2026-10-18T08:12:00",
  },
  {
    id: "usr_administrador",
    name: "Paulo Sebastião",
    email: "administrador@laguna.demo",
    password: DEMO_PASSWORD,
    role: "administrador",
    title: "Administrador do Condomínio",
    status: "activo",
    lastAccess: "2026-10-17T17:40:00",
  },
  {
    id: "usr_financeiro",
    name: "Marta Neto",
    email: "financeiro@laguna.demo",
    password: DEMO_PASSWORD,
    role: "financeiro",
    title: "Responsável Financeira",
    status: "activo",
    lastAccess: "2026-10-18T09:05:00",
  },
  {
    id: "usr_porteiro",
    name: "Domingos Kiala",
    email: "porteiro@laguna.demo",
    password: DEMO_PASSWORD,
    role: "porteiro",
    title: "Porteiro — Turno de dia",
    status: "activo",
    lastAccess: "2026-10-18T07:00:00",
  },
  {
    id: "usr_morador",
    name: "Carla Mendes",
    email: "morador@laguna.demo",
    password: DEMO_PASSWORD,
    role: "morador",
    title: "Moradora",
    residentId: "res_demo",
    status: "activo",
    lastAccess: "2026-10-16T20:31:00",
  },
];

export const roleLabels: Record<Role, string> = {
  admin_geral: "Administrador Geral",
  administrador: "Administrador",
  financeiro: "Financeiro",
  porteiro: "Porteiro",
  morador: "Morador",
};

export const roleDescriptions: Record<Role, string> = {
  admin_geral: "Acesso total a todos os módulos e configurações",
  administrador: "Gestão operacional do condomínio",
  financeiro: "Quotas, pagamentos e relatórios financeiros",
  porteiro: "Visitantes, acessos e ocorrências",
  morador: "Quotas, pagamentos, circulares e documentos",
};
