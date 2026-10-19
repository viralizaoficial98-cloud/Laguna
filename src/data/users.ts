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
    name: "Administração Geral",
    email: "admin@laguna.demo",
    password: DEMO_PASSWORD,
    role: "admin_geral",
    title: "Conta de administração da plataforma",
    status: "activo",
    lastAccess: "2026-10-18T08:12:00",
  },
  {
    id: "usr_administrador",
    name: "José Leiria",
    email: "administrador@laguna.demo",
    password: DEMO_PASSWORD,
    role: "administrador",
    title: "Administrador do Condomínio",
    status: "activo",
    lastAccess: "2026-10-17T17:40:00",
  },
  {
    id: "usr_financeiro",
    name: "Gestão Financeira",
    email: "financeiro@laguna.demo",
    password: DEMO_PASSWORD,
    role: "financeiro",
    title: "Conta de demonstração — Financeiro",
    status: "activo",
    lastAccess: "2026-10-18T09:05:00",
  },
  {
    id: "usr_porteiro",
    name: "Portaria",
    email: "porteiro@laguna.demo",
    password: DEMO_PASSWORD,
    role: "porteiro",
    title: "Portaria — Entrada principal",
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
  administrador: "Moradores, blocos, apartamentos, quotas, comunicados, circulares, visitas e relatórios",
  financeiro: "Quotas trimestrais, comprovativos e relatórios financeiros",
  porteiro: "Consulta de visitas autorizadas e confirmação de entradas/saídas",
  morador: "Quotas, comprovativos, visitas, comunicados e circulares",
};
