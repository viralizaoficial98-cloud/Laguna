"use client";

import { Ban, CheckCircle2, Clock, History, KeyRound, Lock, LockOpen, Pencil, Plus, RefreshCw, ShieldCheck, UserCheck, UserPlus, Users, UserX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Role } from "@/types";
import { useSession } from "@/hooks/use-session";
import { useDemoStore } from "@/store/demo-store";
import { can } from "@/config/permissions";
import { ROLES, roleLabels } from "@/data/users";
import { BLOCKS } from "@/data/management";
import { formatDateTime, includesText } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatCard } from "@/components/ui/stat-card";
import { SearchInput } from "@/components/ui/search-input";
import { Toolbar } from "@/components/ui/toolbar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { IconBtn } from "@/components/ui/icon-button";

type UserStatus = "pendente_activacao" | "activo" | "inactivo" | "bloqueado";
interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  status: UserStatus;
  residentId: string | null;
  apartmentId: string | null;
  block: string | null;
  phone: string | null;
  hasPassword: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}
interface ListResponse {
  users: AppUser[];
  stats: { total: number; active: number; inactive: number; blocked: number; pending: number; residents: number; byRole: { role: Role; count: number }[] };
  recentLogins: { email: string; success: boolean; reason: string | null; at: string }[];
  resetRequests: { targetId: string | null; targetName: string | null; at: string }[];
}
type Op = "activate" | "deactivate" | "block" | "unlock" | "reset_link" | "revoke_sessions";

const STATUS: Record<UserStatus, { label: string; tone: BadgeTone }> = {
  pendente_activacao: { label: "Pendente de activação", tone: "gold" },
  activo: { label: "Activo", tone: "success" },
  inactivo: { label: "Inactivo", tone: "neutral" },
  bloqueado: { label: "Bloqueado", tone: "danger" },
};
const GESTOR_ROLES: Role[] = ["gestor", "morador", "porteiro"];
const OP_TEXT: Record<Op, { title: string; description: string; confirm: string; ok: string }> = {
  activate: { title: "Activar conta?", description: "O utilizador volta a poder iniciar sessão.", confirm: "Activar", ok: "Conta activada" },
  deactivate: { title: "Desactivar conta?", description: "As sessões abertas são terminadas e o acesso deixa de ser possível. O histórico é preservado.", confirm: "Desactivar", ok: "Conta desactivada" },
  block: { title: "Bloquear conta?", description: "Bloqueio administrativo: as sessões são terminadas imediatamente.", confirm: "Bloquear", ok: "Conta bloqueada" },
  unlock: { title: "Desbloquear conta?", description: "Remove o bloqueio (administrativo ou por tentativas falhadas).", confirm: "Desbloquear", ok: "Conta desbloqueada" },
  reset_link: {
    title: "Redefinir palavra-passe?",
    description: "É gerada uma ligação segura de utilização única. Se a conta estiver activa, as sessões abertas são terminadas. A palavra-passe actual nunca é mostrada.",
    confirm: "Gerar ligação",
    ok: "Ligação gerada",
  },
  revoke_sessions: { title: "Terminar todas as sessões?", description: "O utilizador terá de iniciar sessão novamente em todos os dispositivos.", confirm: "Terminar sessões", ok: "Sessões terminadas" },
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`);
  return json as T;
}

export default function UtilizadoresPage() {
  const session = useSession();
  const privileged = can(session?.role, "users.manage_privileged");
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"" | Role>("");
  const [status, setStatus] = useState<"" | UserStatus>("");
  const [editing, setEditing] = useState<AppUser | "new" | null>(null);
  const [confirm, setConfirm] = useState<{ user: AppUser; op: Op } | null>(null);
  const [link, setLink] = useState<{ user: AppUser; url: string; hours: number; type: string } | null>(null);
  const [historyOf, setHistoryOf] = useState<AppUser | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<ListResponse>("/api/users"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }, []);
  useEffect(() => {
    // carregamento inicial a partir da API (o estado é actualizado após a resposta)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const manageable = (u: AppUser) => privileged || GESTOR_ROLES.includes(u.role);
  const rows = useMemo(
    () => (data?.users ?? []).filter((u) => (!role || u.role === role) && (!status || u.status === status) && includesText([u.name, u.email, u.title, u.block ?? ""], q)),
    [data, role, status, q],
  );

  const runOp = async (u: AppUser, op: Op) => {
    try {
      const r = await api<{ link?: string; emailed?: boolean; expiresHours?: number; type?: string }>(`/api/users/${u.id}/actions`, { method: "POST", body: JSON.stringify({ op }) });
      if (op === "reset_link") {
        if (r.link) setLink({ user: u, url: r.link, hours: r.expiresHours ?? 24, type: r.type ?? "reset" });
        else toast.success(`Ligação enviada por email para ${u.email}.`);
      } else toast.success(OP_TEXT[op].ok);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Operação recusada.");
    }
  };

  const locked = (u: AppUser) => u.status === "bloqueado" || (u.lockedUntil && new Date(u.lockedUntil).getTime() > Date.now());

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Gestão de Utilizadores"
        description={privileged ? "Todas as contas do portal: perfis, activação, bloqueio, palavras-passe e histórico." : "Contas operacionais, de moradores e de portaria. As contas do Administrador e do Gestor Financeiro são geridas por José Leiria."}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void load()} aria-label="Actualizar">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setEditing("new")}>
              <UserPlus className="h-4 w-4" /> Novo utilizador
            </Button>
          </div>
        }
      />
      {error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6" data-testid="users-stats">
            <StatCard index={0} highlight label="Total de utilizadores" value={data.stats.total} icon={Users} />
            <StatCard index={1} label="Activos" value={data.stats.active} icon={UserCheck} tone="success" />
            <StatCard index={2} label="Inactivos" value={data.stats.inactive} icon={UserX} tone="info" />
            <StatCard index={3} label="Pendentes de activação" value={data.stats.pending} icon={Clock} tone="gold" />
            <StatCard index={4} label="Contas bloqueadas" value={data.stats.blocked} icon={Lock} tone="danger" />
            <StatCard index={5} label="Moradores registados" value={data.stats.residents} icon={ShieldCheck} tone="navy" />
          </div>
          <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card>
              <CardHeader title="Utilizadores por perfil" />
              <ul className="divide-y divide-graphite-100 text-sm">
                {data.stats.byRole.map((r) => (
                  <li key={r.role} className="flex justify-between px-5 py-2.5">
                    <span>{roleLabels[r.role]}</span>
                    <span className="font-semibold text-navy-900 tabular-nums">{r.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Últimos acessos" description="Tentativas de início de sessão" />
              <ul className="max-h-64 divide-y divide-graphite-100 overflow-auto text-sm">
                {data.recentLogins.map((l, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-5 py-2">
                    <span className="min-w-0 truncate">{l.email}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-graphite-500">
                      {formatDateTime(l.at)} {l.success ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Ban className="h-3.5 w-3.5 text-red-500" />}
                    </span>
                  </li>
                ))}
                {!data.recentLogins.length && <li className="px-5 py-4 text-xs text-graphite-400">Sem acessos registados.</li>}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Pedidos de redefinição" description="Pedidos feitos em “Esqueceu-se da palavra-passe?” (7 dias)" />
              <ul className="max-h-64 divide-y divide-graphite-100 overflow-auto text-sm">
                {data.resetRequests.map((r, i) => {
                  const u = data.users.find((x) => x.id === r.targetId);
                  return (
                    <li key={i} className="flex items-center justify-between gap-3 px-5 py-2">
                      <span className="min-w-0 truncate">{r.targetName}</span>
                      {u && manageable(u) ? (
                        <Button size="sm" variant="outline" onClick={() => setConfirm({ user: u, op: "reset_link" })}>
                          Gerar ligação
                        </Button>
                      ) : (
                        <span className="text-xs text-graphite-500">{formatDateTime(r.at)}</span>
                      )}
                    </li>
                  );
                })}
                {!data.resetRequests.length && <li className="px-5 py-4 text-xs text-graphite-400">Sem pedidos pendentes.</li>}
              </ul>
            </Card>
          </div>
        </>
      )}

      <Card>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Nome, email ou bloco…" className="sm:w-72" />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select value={role} onChange={(e) => setRole(e.target.value as Role | "")} aria-label="Filtrar por perfil" className="sm:w-52">
              <option value="">Todos os perfis</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabels[r]}
                </option>
              ))}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value as UserStatus | "")} aria-label="Filtrar por estado" className="sm:w-52">
              <option value="">Todos os estados</option>
              {(Object.keys(STATUS) as UserStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS[s].label}
                </option>
              ))}
            </Select>
          </div>
        </Toolbar>
        <DataTable
          rows={rows}
          rowKey={(u) => u.id}
          emptyTitle={data ? "Sem utilizadores" : "A carregar…"}
          columns={[
            {
              key: "name",
              header: "Utilizador",
              primary: true,
              cell: (u) => (
                <span className="flex items-center gap-3">
                  <Avatar name={u.name} size="sm" />
                  <span className="min-w-0">
                    <span className="block font-medium text-navy-900">{u.name}</span>
                    <span className="block truncate text-xs text-graphite-500">{u.email}</span>
                  </span>
                </span>
              ),
            },
            { key: "role", header: "Perfil", cell: (u) => <Badge tone="navy">{roleLabels[u.role]}</Badge> },
            { key: "apt", header: "Bloco / apart.", hideOnMobile: true, cell: (u) => (u.apartmentId ? u.apartmentId.replace(/^apt_(\d+)_(\d+)$/, "Bloco $1 · $2") : u.block ? `Bloco ${u.block}` : "—") },
            {
              key: "status",
              header: "Estado",
              cell: (u) => (
                <span className="flex flex-wrap gap-1">
                  <Badge tone={STATUS[u.status].tone} dot>
                    {STATUS[u.status].label}
                  </Badge>
                  {u.lockedUntil && new Date(u.lockedUntil).getTime() > Date.now() && <Badge tone="warning">Bloqueio temporário</Badge>}
                </span>
              ),
            },
            { key: "last", header: "Último acesso", hideOnMobile: true, cell: (u) => (u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—") },
            {
              key: "actions",
              header: "",
              align: "right",
              cell: (u) =>
                manageable(u) ? (
                  <div className="flex justify-end gap-0.5">
                    <IconBtn label="Editar" onClick={() => setEditing(u)}>
                      <Pencil className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn label="Redefinir Palavra-passe" onClick={() => setConfirm({ user: u, op: "reset_link" })}>
                      <KeyRound className="h-4 w-4" />
                    </IconBtn>
                    {locked(u) ? (
                      <IconBtn label="Desbloquear" onClick={() => setConfirm({ user: u, op: "unlock" })}>
                        <LockOpen className="h-4 w-4" />
                      </IconBtn>
                    ) : u.id !== session?.userId ? (
                      <IconBtn label="Bloquear" danger onClick={() => setConfirm({ user: u, op: "block" })}>
                        <Lock className="h-4 w-4" />
                      </IconBtn>
                    ) : null}
                    {u.status === "activo" && u.id !== session?.userId && (
                      <IconBtn label="Desactivar" danger onClick={() => setConfirm({ user: u, op: "deactivate" })}>
                        <UserX className="h-4 w-4" />
                      </IconBtn>
                    )}
                    {u.status === "inactivo" && (
                      <IconBtn label="Activar" onClick={() => setConfirm({ user: u, op: "activate" })}>
                        <UserCheck className="h-4 w-4" />
                      </IconBtn>
                    )}
                    <IconBtn label="Histórico de acesso" onClick={() => setHistoryOf(u)}>
                      <History className="h-4 w-4" />
                    </IconBtn>
                  </div>
                ) : (
                  <span className="text-[11px] text-graphite-400">Gerida pelo Administrador</span>
                ),
            },
          ]}
        />
      </Card>

      {editing && <UserForm user={editing === "new" ? null : editing} privileged={privileged} selfId={session?.userId} onClose={() => setEditing(null)} onSaved={load} />}
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm ? `${OP_TEXT[confirm.op].title} — ${confirm.user.name}` : ""}
        description={confirm ? OP_TEXT[confirm.op].description : ""}
        confirmLabel={confirm ? OP_TEXT[confirm.op].confirm : ""}
        tone={confirm && ["deactivate", "block", "revoke_sessions"].includes(confirm.op) ? "danger" : "primary"}
        onConfirm={() => {
          if (confirm) void runOp(confirm.user, confirm.op);
          setConfirm(null);
        }}
      />
      <Modal open={!!link} onClose={() => setLink(null)} title={link?.type === "activation" ? "Ligação de activação" : "Ligação de redefinição"} description={link ? `${link.user.name} · válida durante ${link.hours} h · utilização única` : ""}>
        {link && (
          <div className="space-y-3 text-sm">
            <p className="rounded-xl bg-amber-50 p-3 text-amber-900">O serviço de email não está configurado. Entregue esta ligação ao titular por um canal seguro (pessoalmente ou mensagem directa). Ela não volta a ser mostrada.</p>
            <Input readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} data-testid="reset-link" />
            <Button
              onClick={() => {
                void navigator.clipboard?.writeText(link.url);
                toast.success("Ligação copiada.");
              }}
            >
              Copiar ligação
            </Button>
          </div>
        )}
      </Modal>
      {historyOf && <HistoryModal user={historyOf} onClose={() => setHistoryOf(null)} onRevoke={() => setConfirm({ user: historyOf, op: "revoke_sessions" })} />}
    </>
  );
}

function UserForm({ user, privileged, selfId, onClose, onSaved }: { user: AppUser | null; privileged: boolean; selfId?: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const apartments = useDemoStore((s) => s.apartments);
  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    role: (user?.role ?? "morador") as Role,
    title: user?.title ?? "",
    block: user?.block ?? user?.apartmentId?.split("_")[1] ?? "01",
    apartmentId: user?.apartmentId ?? "",
    phone: user?.phone ?? "",
  });
  const [busy, setBusy] = useState(false);
  const roles = privileged ? ROLES : GESTOR_ROLES;
  const apts = apartments.filter((a) => a.block === form.block && a.active).sort((a, b) => a.number.localeCompare(b.number));
  const self = user?.id === selfId;

  const save = async () => {
    setBusy(true);
    try {
      const body = { name: form.name, email: form.email, role: form.role, title: form.title || undefined, apartmentId: form.apartmentId || null, phone: form.phone || null };
      if (user) await api(`/api/users/${user.id}`, { method: "PATCH", body: JSON.stringify(body) });
      else await api("/api/users", { method: "POST", body: JSON.stringify(body) });
      toast.success(user ? "Utilizador actualizado" : "Utilizador criado — pendente de activação", { description: user ? undefined : "Gere a ligação de activação em “Redefinir Palavra-passe”." });
      await onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível guardar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={user ? `Editar — ${user.name}` : "Novo utilizador"}
      description={user ? "Alterar email ou perfil termina as sessões abertas." : "A conta é criada sem palavra-passe; o titular define-a com a ligação de activação."}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={busy}>
            {user ? "Guardar" : (
              <>
                <Plus className="h-4 w-4" /> Criar utilizador
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2" data-testid="user-form">
        <Field label="Nome" required>
          <Input name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Email" required>
          <Input name="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Perfil" hint={!privileged ? "Pode atribuir: Gestor Operacional, Morador e Portaria." : undefined}>
          <Select name="role" value={form.role} disabled={self} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {roleLabels[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Função / título" hint="Opcional">
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Bloco">
          <Select value={form.block} onChange={(e) => setForm({ ...form, block: e.target.value, apartmentId: "" })} aria-label="Bloco">
            {BLOCKS.map((b) => (
              <option key={b} value={b}>
                Bloco {b}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Apartamento" required={form.role === "morador"} hint={form.role === "morador" ? "Obrigatório para moradores — associa a conta ao registo da fracção." : "Opcional"}>
          <Select name="apartmentId" value={form.apartmentId} onChange={(e) => setForm({ ...form, apartmentId: e.target.value })} aria-label="Apartamento">
            <option value="">—</option>
            {apts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.number} · {a.typology}
                {a.residentId ? "" : " · sem morador"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Telefone" hint="Opcional">
          <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

interface HistoryResponse {
  activeSessions: number;
  changes: { at: string; actor: string; action: string; before: string | null; after: string | null }[];
  logins: { at: string; success: boolean; reason: string | null; ip: string | null; userAgent: string | null }[];
}
const ACTION_LABEL: Record<string, string> = {
  conta_criada: "Conta criada",
  conta_editada: "Conta editada",
  conta_activada: "Conta activada pelo titular",
  conta_activada_gestao: "Conta activada",
  conta_desactivada: "Conta desactivada",
  conta_bloqueada: "Conta bloqueada",
  conta_desbloqueada: "Conta desbloqueada",
  bloqueio_temporario: "Bloqueio temporário (tentativas falhadas)",
  redefinicao_iniciada: "Redefinição de palavra-passe iniciada",
  activacao_iniciada: "Ligação de activação gerada",
  palavra_passe_redefinida: "Palavra-passe redefinida",
  palavra_passe_alterada: "Palavra-passe alterada pelo titular",
  pedido_redefinicao: "Pedido de redefinição",
  sessoes_terminadas: "Sessões terminadas",
};

function HistoryModal({ user, onClose, onRevoke }: { user: AppUser; onClose: () => void; onRevoke: () => void }) {
  const [h, setH] = useState<HistoryResponse | null>(null);
  useEffect(() => {
    api<HistoryResponse>(`/api/users/${user.id}/history`)
      .then(setH)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Erro"));
  }, [user.id]);
  const diff = (b: string | null, a: string | null) => {
    try {
      const before = b ? JSON.parse(b) : {};
      const after = a ? JSON.parse(a) : {};
      return Object.keys({ ...before, ...after })
        .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
        .map((k) => `${k}: ${before[k] ?? "—"} → ${after[k] ?? "—"}`)
        .join(" · ");
    } catch {
      return "";
    }
  };
  return (
    <Modal open onClose={onClose} size="xl" title={`Histórico — ${user.name}`} description={h ? `${h.activeSessions} sessão(ões) activa(s)` : "A carregar…"}>
      {h && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wider text-graphite-500 uppercase">Alterações à conta</p>
            <ol className="max-h-96 space-y-2 overflow-auto text-xs">
              {h.changes.map((c, i) => (
                <li key={i} className="rounded-lg bg-graphite-50 p-2">
                  <span className="text-graphite-400">{formatDateTime(c.at)}</span> · <strong>{ACTION_LABEL[c.action] ?? c.action}</strong> · {c.actor}
                  {diff(c.before, c.after) && <span className="mt-0.5 block text-graphite-600">{diff(c.before, c.after)}</span>}
                </li>
              ))}
              {!h.changes.length && <li className="text-graphite-400">Sem alterações.</li>}
            </ol>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wider text-graphite-500 uppercase">Acessos</p>
              {h.activeSessions > 0 && (
                <Button size="sm" variant="outline" onClick={onRevoke}>
                  Terminar sessões
                </Button>
              )}
            </div>
            <ol className="max-h-96 space-y-1 overflow-auto text-xs">
              {h.logins.map((l, i) => (
                <li key={i} className="flex justify-between gap-2 border-b border-graphite-100 py-1.5">
                  <span>
                    {formatDateTime(l.at)} · {l.ip ?? "—"}
                  </span>
                  <span className={l.success ? "text-emerald-700" : "text-red-600"}>{l.success ? "Sucesso" : (l.reason ?? "Falhou").replace(/_/g, " ")}</span>
                </li>
              ))}
              {!h.logins.length && <li className="text-graphite-400">Sem acessos.</li>}
            </ol>
          </div>
        </div>
      )}
    </Modal>
  );
}
