import {
  Banknote,
  Building2,
  ClipboardList,
  DoorOpen,
  FileStack,
  FileText,
  Home,
  LayoutDashboard,
  Megaphone,
  Receipt,
  ScrollText,
  Settings,
  ShieldAlert,
  UserRound,
  Users,
  Wallet,
  BarChart3,
  History,
  BookOpenCheck,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types";

export interface AppNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  /** Etiqueta alternativa por perfil (ex.: "Visitantes" para o porteiro). */
  labelFor?: Partial<Record<Role, string>>;
}

export interface AppNavGroup {
  label: string;
  items: AppNavItem[];
}

const ALL: Role[] = ["admin_geral", "administrador", "financeiro", "porteiro", "morador"];
const STAFF: Role[] = ["admin_geral", "administrador"];

export const appNavigation: AppNavGroup[] = [
  {
    label: "Geral",
    items: [{ href: "/painel", label: "Dashboard", icon: LayoutDashboard, roles: ALL }],
  },
  {
    label: "Minha área",
    items: [
      { href: "/painel/meu-apartamento", label: "Meu Apartamento", icon: Home, roles: ["morador"] },
      { href: "/painel/minhas-quotas", label: "Minhas Quotas", icon: Wallet, roles: ["morador"] },
      { href: "/painel/meus-pagamentos", label: "Pagamentos", icon: Receipt, roles: ["morador"] },
      { href: "/painel/comprovativos", label: "Comprovativos", icon: BookOpenCheck, roles: ["morador"] },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/painel/apartamentos", label: "Apartamentos", icon: Building2, roles: STAFF },
      { href: "/painel/moradores", label: "Moradores", icon: Users, roles: STAFF },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { href: "/painel/financeiro", label: "Visão financeira", icon: BarChart3, roles: ["admin_geral", "administrador"] },
      { href: "/painel/pagamentos", label: "Pagamentos", icon: Banknote, roles: ["admin_geral", "administrador", "financeiro"], labelFor: { financeiro: "Aprovação de pagamentos" } },
      { href: "/painel/quotas", label: "Quotas", icon: Wallet, roles: ["admin_geral", "financeiro"] },
      { href: "/painel/conta-corrente", label: "Conta corrente", icon: ClipboardList, roles: ["admin_geral", "financeiro"] },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { href: "/painel/circulares", label: "Circulares", icon: ScrollText, roles: ["admin_geral", "administrador", "morador"] },
      { href: "/painel/comunicados", label: "Comunicados", icon: Megaphone, roles: ALL },
      { href: "/painel/documentos", label: "Documentos", icon: FileStack, roles: ["admin_geral", "administrador", "financeiro", "morador"] },
    ],
  },
  {
    label: "Portaria",
    items: [
      { href: "/painel/portaria", label: "Portaria", icon: DoorOpen, roles: ["admin_geral", "administrador", "porteiro"], labelFor: { porteiro: "Visitantes" } },
      { href: "/painel/ocorrencias", label: "Ocorrências", icon: ShieldAlert, roles: ["admin_geral", "administrador", "porteiro"] },
      { href: "/painel/acessos", label: "Histórico de acessos", icon: History, roles: ["admin_geral", "porteiro"] },
    ],
  },
  {
    label: "Administração",
    items: [
      { href: "/painel/relatorios", label: "Relatórios", icon: FileText, roles: ["admin_geral", "administrador", "financeiro"] },
      { href: "/painel/configuracoes", label: "Configurações", icon: Settings, roles: ["admin_geral"] },
    ],
  },
  {
    label: "Conta",
    items: [{ href: "/painel/perfil", label: "Meu Perfil", icon: UserRound, roles: ALL }],
  },
];

export function navForRole(role: Role): AppNavGroup[] {
  return appNavigation
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => i.roles.includes(role)).map((i) => ({ ...i, label: i.labelFor?.[role] ?? i.label })),
    }))
    .filter((g) => g.items.length > 0);
}

/** Verifica se o perfil pode aceder a um caminho do painel. */
export function canAccess(role: Role, pathname: string) {
  const items = appNavigation.flatMap((g) => g.items);
  const match = items
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match ? match.roles.includes(role) : true;
}
