import type { DemoUser, Role } from "@/types";

/**
 * Utilizadores do LOGIN DEMONSTRATIVO (quatro perfis).
 * Os emails são apenas identificadores de acesso de demonstração — não se assume
 * a existência de caixas de correio reais. A palavra-passe é exclusiva da demo.
 * Na fase de backend, esta lista será substituída por autenticação real
 * (palavras-passe com hash, sessões no servidor).
 */
export const DEMO_PASSWORD = "DemoLaguna2026";

export const demoUsers: DemoUser[] = [
  {
    id: "usr_jose_leiria",
    name: "José Leiria",
    email: "jose.leiria@residenciallaguna.ao",
    password: DEMO_PASSWORD,
    role: "administrador",
    title: "Administrador do Condomínio",
    status: "activo",
    lastAccess: "2026-10-21T17:40:00",
  },
  {
    id: "usr_nelson_rodrigues",
    name: "Nelson Rodrigues",
    email: "nelson.rodrigues@residenciallaguna.ao",
    password: DEMO_PASSWORD,
    role: "gestor",
    title: "Gestor Operacional",
    status: "activo",
    lastAccess: "2026-10-22T07:30:00",
  },
  {
    id: "usr_manuel_muenho",
    name: "Manuel Muenho",
    email: "manuel.muenho@residenciallaguna.ao",
    password: DEMO_PASSWORD,
    role: "morador",
    title: "Morador · Bloco 06 · 201",
    residentId: "res_demo",
    status: "activo",
    lastAccess: "2026-10-20T20:31:00",
  },
  {
    id: "usr_portaria",
    name: "Portaria Laguna",
    email: "portaria@residenciallaguna.ao",
    password: DEMO_PASSWORD,
    role: "porteiro",
    title: "Portaria — Entrada principal",
    status: "activo",
    lastAccess: "2026-10-22T06:00:00",
  },
];

export const roleLabels: Record<Role, string> = {
  administrador: "Administrador do Condomínio",
  gestor: "Gestor Operacional",
  morador: "Morador",
  porteiro: "Portaria",
};

export const roleDescriptions: Record<Role, string> = {
  administrador: "Gestão executiva, financeira e administrativa; supervisão operacional",
  gestor: "Elevadores, ocorrências, limpeza, jardinagem, manutenção e fiscalização",
  morador: "Quotas trimestrais, comprovativos, visitas, ocorrências, comunicados e circulares",
  porteiro: "Consulta de visitas autorizadas e confirmação de entradas/saídas",
};

export const ROLES: Role[] = ["administrador", "gestor", "morador", "porteiro"];
