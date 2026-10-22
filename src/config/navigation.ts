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
  UserPlus,
  ArrowUpDown,
  Activity,
  Sparkles,
  Trees,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types";
import { can, type Permission } from "./permissions";

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

const ALL: Role[] = ["administrador", "gestor", "morador", "porteiro"];
const ADM: Role[] = ["administrador"];
const OPS: Role[] = ["administrador", "gestor"];

export const appNavigation: AppNavGroup[] = [
  {
    label: "Geral",
    items: [{ href: "/painel", label: "Dashboard", icon: LayoutDashboard, roles: ALL, labelFor: { administrador: "Dashboard executivo", gestor: "Dashboard operacional" } }],
  },
  {
    label: "Minha área",
    items: [
      { href: "/painel/meu-apartamento", label: "Meu Apartamento", icon: Home, roles: ["morador"] },
      { href: "/painel/minhas-quotas", label: "Minhas Quotas", icon: Wallet, roles: ["morador"] },
      { href: "/painel/visitas", label: "Visitas", icon: UserPlus, roles: ["morador"] },
      { href: "/painel/meus-pagamentos", label: "Pagamentos", icon: Receipt, roles: ["morador"] },
      { href: "/painel/comprovativos", label: "Comprovativos", icon: BookOpenCheck, roles: ["morador"] },
      { href: "/painel/ocorrencias", label: "Minhas ocorrências", icon: ShieldAlert, roles: ["morador"] },
      { href: "/painel/elevadores", label: "Estado dos elevadores", icon: ArrowUpDown, roles: ["morador"] },
    ],
  },
  {
    label: "Executivo",
    items: [
      { href: "/painel/financeiro", label: "Dashboard financeiro", icon: BarChart3, roles: ADM },
      { href: "/painel/operacional", label: "Supervisão operacional", icon: Activity, roles: ADM },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/painel/apartamentos", label: "Blocos e apartamentos", icon: Building2, roles: ADM },
      { href: "/painel/moradores", label: "Moradores", icon: Users, roles: OPS },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { href: "/painel/pagamentos", label: "Pagamentos", icon: Banknote, roles: ADM },
      { href: "/painel/quotas", label: "Quotas trimestrais", icon: Wallet, roles: ADM },
      { href: "/painel/conta-corrente", label: "Conta corrente", icon: ClipboardList, roles: ADM },
    ],
  },
  {
    label: "Operações",
    items: [
      { href: "/painel/elevadores", label: "Elevadores", icon: ArrowUpDown, roles: OPS },
      { href: "/painel/ocorrencias", label: "Ocorrências", icon: ShieldAlert, roles: OPS },
      { href: "/painel/limpeza", label: "Limpeza", icon: Sparkles, roles: OPS },
      { href: "/painel/jardinagem", label: "Jardinagem", icon: Trees, roles: OPS },
      { href: "/painel/manutencao", label: "Manutenção", icon: Wrench, roles: OPS },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { href: "/painel/circulares", label: "Circulares", icon: ScrollText, roles: ["administrador", "gestor", "morador"] },
      { href: "/painel/comunicados", label: "Comunicados", icon: Megaphone, roles: ["administrador", "gestor", "morador"] },
      { href: "/painel/documentos", label: "Documentos", icon: FileStack, roles: ["administrador", "gestor", "morador"] },
    ],
  },
  {
    label: "Portaria",
    items: [
      { href: "/painel/portaria", label: "Visitas autorizadas", icon: DoorOpen, roles: ["administrador", "gestor", "porteiro"], labelFor: { porteiro: "Visitantes autorizados" } },
      { href: "/painel/acessos", label: "Histórico de acessos", icon: History, roles: ["administrador", "porteiro"] },
    ],
  },
  {
    label: "Administração",
    items: [
      { href: "/painel/relatorios", label: "Relatórios", icon: FileText, roles: OPS },
      { href: "/painel/configuracoes", label: "Configurações", icon: Settings, roles: ADM },
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

/** Rotas internas (fora do menu) que exigem uma permissão de operação. */
const ROUTE_PERMISSIONS: { prefix: string; permission: Permission }[] = [{ prefix: "/painel/circulares/editor", permission: "circulars.issue" }];

/** Verifica se o perfil pode aceder a um caminho do painel. */
export function canAccess(role: Role, pathname: string) {
  const rule = ROUTE_PERMISSIONS.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
  if (rule && !can(role, rule.permission)) return false;
  const items = appNavigation.flatMap((g) => g.items).filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  if (items.length === 0) return true;
  const longest = Math.max(...items.map((i) => i.href.length));
  // a mesma rota pode aparecer em grupos diferentes (ex.: Ocorrências para morador e gestor)
  return items.filter((i) => i.href.length === longest).some((i) => i.roles.includes(role));
}
