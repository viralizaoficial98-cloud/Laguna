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
  PartyPopper,
  LogOut,
  Coins,
  UserCog,
  DatabaseZap,
  Landmark,
  KeySquare,
  PenLine,
  FileSignature,
  FileCheck2,
  FilePlus2,
  FileClock,
  Truck,
  PiggyBank,
  HandCoins,
  Building,
  ContactRound,
  ShieldCheck,
  BellRing,
  Gauge,
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

const ALL: Role[] = ["administrador", "gestor", "financeiro", "morador", "porteiro"];
const ADM: Role[] = ["administrador"];
const OPS: Role[] = ["administrador", "gestor"];
const FIN: Role[] = ["administrador", "financeiro"];
const STAFF: Role[] = ["administrador", "gestor", "financeiro"];

export const appNavigation: AppNavGroup[] = [
  {
    label: "Geral",
    items: [{ href: "/painel", label: "Dashboard", icon: LayoutDashboard, roles: ALL, labelFor: { administrador: "Dashboard executivo", gestor: "Dashboard operacional", financeiro: "Dashboard financeiro" } }],
  },
  {
    label: "Minha área",
    items: [
      { href: "/painel/meu-apartamento", label: "Meu Apartamento", icon: Home, roles: ["morador"] },
      { href: "/painel/minhas-quotas", label: "Minhas Quotas", icon: Wallet, roles: ["morador"] },
      { href: "/painel/visitas", label: "Visitas", icon: UserPlus, roles: ["morador"] },
      { href: "/painel/reservas", label: "Reservas de salões", icon: PartyPopper, roles: ["morador"] },
      { href: "/painel/meus-pagamentos", label: "Pagamentos", icon: Receipt, roles: ["morador"] },
      { href: "/painel/comprovativos", label: "Comprovativos", icon: BookOpenCheck, roles: ["morador"] },
      { href: "/painel/ocorrencias", label: "Minhas ocorrências", icon: ShieldAlert, roles: ["morador"] },
      { href: "/painel/elevadores", label: "Estado dos elevadores", icon: ArrowUpDown, roles: ["morador"] },
      { href: "/painel/desocupacao", label: "Desocupação", icon: LogOut, roles: ["morador"] },
      { href: "/painel/declaracoes", label: "Solicitar Declaração", icon: FileSignature, roles: ["morador"] },
    ],
  },
  {
    label: "Executivo",
    items: [
      { href: "/painel/financeiro", label: "Dashboard financeiro", icon: BarChart3, roles: ["administrador", "gestor"], labelFor: { gestor: "Resumo financeiro" } },
      { href: "/painel/operacional", label: "Supervisão operacional", icon: Activity, roles: ADM },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/painel/apartamentos", label: "Blocos e apartamentos", icon: Building2, roles: ADM },
      { href: "/painel/fraccoes", label: "Fracções", icon: Building, roles: ["administrador", "financeiro"] },
      { href: "/painel/proprietarios", label: "Proprietários", icon: KeySquare, roles: ADM },
      { href: "/painel/inquilinos", label: "Moradores e inquilinos", icon: ContactRound, roles: ADM },
      { href: "/painel/moradores", label: "Moradores", icon: Users, roles: STAFF },
      { href: "/painel/desocupacao", label: "Desocupações", icon: LogOut, roles: STAFF },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { href: "/painel/pagamentos", label: "Pagamentos e comprovativos", icon: Banknote, roles: STAFF, labelFor: { gestor: "Validação de pagamentos" } },
      { href: "/painel/quotas", label: "Quotas trimestrais", icon: Wallet, roles: FIN },
      { href: "/painel/conta-corrente", label: "Conta corrente", icon: ClipboardList, roles: FIN },
      { href: "/painel/pagamento-presencial", label: "Registar pagamento presencial", icon: HandCoins, roles: FIN },
      { href: "/painel/receitas", label: "Receitas", icon: PiggyBank, roles: FIN },
      { href: "/painel/despesas", label: "Despesas", icon: Coins, roles: FIN },
      { href: "/painel/fornecedores", label: "Fornecedores", icon: Truck, roles: FIN },
      { href: "/painel/orcamento", label: "Orçamento e execução", icon: Landmark, roles: FIN },
      { href: "/painel/reservas", label: "Reservas de salões", icon: PartyPopper, roles: STAFF },
    ],
  },
  {
    label: "Operações",
    items: [
      { href: "/painel/elevadores", label: "Elevadores", icon: ArrowUpDown, roles: OPS },
      { href: "/painel/ocorrencias", label: "Ocorrências", icon: ShieldAlert, roles: STAFF, labelFor: { financeiro: "Ocorrências (consulta)" } },
      { href: "/painel/limpeza", label: "Limpeza", icon: Sparkles, roles: OPS },
      { href: "/painel/jardinagem", label: "Jardinagem", icon: Trees, roles: OPS },
      { href: "/painel/manutencao", label: "Manutenção", icon: Wrench, roles: OPS },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { href: "/painel/circulares", label: "Circulares", icon: ScrollText, roles: ["administrador", "gestor", "financeiro", "morador"] },
      { href: "/painel/comunicados", label: "Comunicados", icon: Megaphone, roles: ["administrador", "gestor", "financeiro", "morador"] },
      { href: "/painel/documentos", label: "Documentos", icon: FileStack, roles: ["administrador", "gestor", "morador"] },
      { href: "/painel/declaracoes", label: "Declarações", icon: FileSignature, roles: ADM },
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
      { href: "/painel/utilizadores", label: "Gestão de Utilizadores", icon: UserCog, roles: OPS },
      { href: "/painel/relatorios", label: "Relatórios", icon: FileText, roles: STAFF },
      { href: "/painel/importacao", label: "Importação de dados", icon: DatabaseZap, roles: ADM },
      { href: "/painel/assinatura", label: "Assinatura electrónica", icon: PenLine, roles: ADM },
      { href: "/painel/auditoria", label: "Auditoria", icon: ShieldCheck, roles: ADM },
      { href: "/painel/configuracoes", label: "Configurações", icon: Settings, roles: ADM },
    ],
  },
  {
    label: "Conta",
    items: [{ href: "/painel/perfil", label: "Meu Perfil", icon: UserRound, roles: ALL }],
  },
];

/**
 * Menu do Gestor Operacional (Nelson Rodrigues) — centro de gestão do condomínio.
 * As permissões de cada operação continuam a ser verificadas no servidor.
 */
const G: Role[] = ["gestor"];
export const gestorNavigation: AppNavGroup[] = [
  {
    label: "Dashboard",
    items: [
      { href: "/painel", label: "Dashboard operacional", icon: LayoutDashboard, roles: G },
      { href: "/painel/executivo", label: "Dashboard executivo", icon: Gauge, roles: G },
      { href: "/painel/financeiro", label: "Resumo financeiro", icon: BarChart3, roles: G },
      { href: "/painel/notificacoes", label: "Alertas e notificações", icon: BellRing, roles: G },
    ],
  },
  {
    label: "Gestão do Condomínio",
    items: [
      { href: "/painel/fraccoes", label: "Fracções", icon: Building, roles: G },
      { href: "/painel/proprietarios", label: "Proprietários", icon: KeySquare, roles: G },
      { href: "/painel/inquilinos", label: "Moradores e inquilinos", icon: ContactRound, roles: G },
      { href: "/painel/moradores", label: "Cadastro de moradores", icon: Users, roles: G },
      { href: "/painel/desocupacao", label: "Desocupações", icon: LogOut, roles: G },
      { href: "/painel/utilizadores", label: "Utilizadores", icon: UserCog, roles: G },
    ],
  },
  {
    label: "Gestão Financeira",
    items: [
      { href: "/painel/quotas", label: "Quotas", icon: Wallet, roles: G },
      { href: "/painel/pagamentos", label: "Pagamentos", icon: Banknote, roles: G },
      { href: "/painel/pagamento-presencial", label: "Registar pagamento presencial", icon: HandCoins, roles: G },
      { href: "/painel/comprovativos", label: "Comprovativos", icon: BookOpenCheck, roles: G },
      { href: "/painel/conta-corrente", label: "Contas correntes", icon: ClipboardList, roles: G },
      { href: "/painel/receitas", label: "Receitas", icon: PiggyBank, roles: G },
      { href: "/painel/despesas", label: "Despesas", icon: Coins, roles: G },
      { href: "/painel/fornecedores", label: "Fornecedores", icon: Truck, roles: G },
      { href: "/painel/orcamento", label: "Orçamento e execução", icon: Landmark, roles: G },
      { href: "/painel/relatorios", label: "Relatórios financeiros", icon: FileText, roles: G },
    ],
  },
  {
    label: "Documentos",
    items: [
      { href: "/painel/declaracoes", label: "Solicitações de declarações", icon: FileSignature, roles: G },
      { href: "/painel/declaracoes/emitir", label: "Emitir declaração", icon: FilePlus2, roles: G },
      { href: "/painel/declaracoes/pendentes", label: "Documentos pendentes", icon: FileClock, roles: G },
      { href: "/painel/declaracoes/assinados", label: "Documentos assinados", icon: FileCheck2, roles: G },
      { href: "/painel/circulares", label: "Circulares", icon: ScrollText, roles: G },
      { href: "/painel/comunicados", label: "Comunicados", icon: Megaphone, roles: G },
      { href: "/painel/documentos", label: "Arquivo documental", icon: FileStack, roles: G },
    ],
  },
  {
    label: "Operações",
    items: [
      { href: "/painel/elevadores", label: "Elevadores", icon: ArrowUpDown, roles: G },
      { href: "/painel/ocorrencias", label: "Ocorrências", icon: ShieldAlert, roles: G },
      { href: "/painel/manutencao", label: "Manutenção", icon: Wrench, roles: G },
      { href: "/painel/limpeza", label: "Limpeza", icon: Sparkles, roles: G },
      { href: "/painel/jardinagem", label: "Jardinagem", icon: Trees, roles: G },
      { href: "/painel/reservas", label: "Reservas de salões", icon: PartyPopper, roles: G },
      { href: "/painel/portaria", label: "Portaria e visitas", icon: DoorOpen, roles: G },
    ],
  },
  {
    label: "Administração",
    items: [
      { href: "/painel/importacao", label: "Importação Excel", icon: DatabaseZap, roles: G },
      { href: "/painel/utilizadores", label: "Gestão de utilizadores", icon: UserCog, roles: G },
      { href: "/painel/assinatura", label: "Assinatura electrónica", icon: PenLine, roles: G },
      { href: "/painel/configuracoes", label: "Configurações", icon: Settings, roles: G },
      { href: "/painel/auditoria", label: "Auditoria", icon: ShieldCheck, roles: G },
    ],
  },
  { label: "Conta", items: [{ href: "/painel/perfil", label: "Meu Perfil", icon: UserRound, roles: G }] },
];

export function navForRole(role: Role): AppNavGroup[] {
  if (role === "gestor") return gestorNavigation;
  return appNavigation
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => i.roles.includes(role)).map((i) => ({ ...i, label: i.labelFor?.[role] ?? i.label })),
    }))
    .filter((g) => g.items.length > 0);
}

/** Rotas internas (fora do menu) que exigem uma permissão de operação. */
const ROUTE_PERMISSIONS: { prefix: string; permission: Permission }[] = [
  { prefix: "/painel/circulares/editor", permission: "circulars.issue" },
  { prefix: "/painel/declaracoes/emitir", permission: "declarations.manage" },
  { prefix: "/painel/declaracoes/pendentes", permission: "declarations.manage" },
  { prefix: "/painel/declaracoes/assinados", permission: "declarations.manage" },
  { prefix: "/painel/executivo", permission: "executive.view" },
];
/** Rotas disponíveis para todos os perfis autenticados. */
const ROUTE_ANY = ["/painel/notificacoes"];

/** Verifica se o perfil pode aceder a um caminho do painel. */
export function canAccess(role: Role, pathname: string) {
  if (ROUTE_ANY.includes(pathname)) return true;
  const rule = ROUTE_PERMISSIONS.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
  if (rule) return can(role, rule.permission);
  const items = [...appNavigation, ...gestorNavigation].flatMap((g) => g.items).filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  if (items.length === 0) return true;
  const longest = Math.max(...items.map((i) => i.href.length));
  // a mesma rota pode aparecer em grupos diferentes (ex.: Ocorrências para morador e gestor)
  return items.filter((i) => i.href.length === longest).some((i) => i.roles.includes(role));
}
