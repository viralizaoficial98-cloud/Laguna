"use client";

import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Clock, Gauge, ListChecks, Pencil, Play, Plus, Trash2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { OpsArea, OpsTask } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { useSession } from "@/hooks/use-session";
import { taskState, useOperations } from "@/hooks/use-operations";
import { can } from "@/config/permissions";
import { BLOCKS } from "@/data/management";
import { cn, formatDate, formatDateTime, formatKz, includesText, todayISO, uid } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Toolbar } from "@/components/ui/toolbar";
import { Tabs } from "@/components/ui/tabs";
import { Modal } from "@/components/ui/modal";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { IconBtn } from "@/components/ui/icon-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { HBars } from "@/components/charts/charts";

export interface OpsModuleConfig {
  area: OpsArea;
  title: string;
  description: string;
  types: string[];
  locations: string[];
  teams: string[];
}

const FREQUENCIES: NonNullable<OpsTask["frequency"]>[] = ["Diária", "Semanal", "Quinzenal", "Mensal", "Trimestral", "Pontual"];
const REPEAT: Record<string, { n: number; days: number }> = { Diária: { n: 7, days: 1 }, Semanal: { n: 4, days: 7 }, Quinzenal: { n: 2, days: 14 }, Mensal: { n: 3, days: 30 }, Trimestral: { n: 2, days: 91 } };
type StateFilter = "" | "programada" | "em_execucao" | "concluida" | "atrasada";

function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function mondayOf(date: string) {
  const d = new Date(`${date}T12:00:00`);
  const dow = (d.getDay() + 6) % 7;
  return addDays(date, -dow);
}

/** Módulo operacional: plano, calendário, execução e fiscalização (Limpeza, Jardinagem, Manutenção). */
export function OpsModule({ config }: { config: OpsModuleConfig }) {
  const session = useSession();
  const canManage = can(session?.role, "operations.manage");
  const all = useDemoStore((s) => s.opsTasks);
  const saveTask = useDemoStore((s) => s.saveOpsTask);
  const deleteTask = useDemoStore((s) => s.deleteOpsTask);
  const today = todayISO();
  const isMaint = config.area === "manutencao";

  const [view, setView] = useState<"plano" | "calendario" | "fiscalizacao">("plano");
  const [state, setState] = useState<StateFilter>("");
  const [type, setType] = useState("");
  const [team, setTeam] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState(addDays(today, -14));
  const [to, setTo] = useState(addDays(today, 14));
  const [week, setWeek] = useState(mondayOf(today));
  const [editing, setEditing] = useState<OpsTask | "new" | null>(null);
  const [concluding, setConcluding] = useState<OpsTask | null>(null);
  const [inspecting, setInspecting] = useState<OpsTask | null>(null);
  const [deleting, setDeleting] = useState<OpsTask | null>(null);

  const tasks = useMemo(() => all.filter((t) => t.area === config.area), [all, config.area]);
  const kpi = useOperations({ from, to });
  const m = config.area === "limpeza" ? kpi.cleaning : config.area === "jardinagem" ? kpi.gardening : kpi.maintenance;
  const rows = useMemo(
    () =>
      tasks
        .filter((t) => (!from || t.scheduledDate >= from) && (!to || t.scheduledDate <= to))
        .filter((t) => (!state || taskState(t, today) === state) && (!type || t.type === type) && (!team || t.responsible === team))
        .filter((t) => includesText([t.title, t.location, t.responsible, t.equipment], q))
        .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)),
    [tasks, from, to, state, type, team, q, today],
  );
  const toInspect = tasks.filter((t) => t.status === "concluida" && !t.inspection).sort((a, b) => (b.executedDate ?? "").localeCompare(a.executedDate ?? ""));
  const inspected = tasks.filter((t) => t.inspection).sort((a, b) => (b.inspection!.at).localeCompare(a.inspection!.at));
  const byType = config.types.map((tp) => ({ label: tp, value: rows.filter((t) => t.type === tp).length })).filter((x) => x.value);

  const run = (fn: () => void, msg: string) => {
    try {
      fn();
      toast.success(msg);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const actions = (t: OpsTask) =>
    canManage ? (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        {t.status === "programada" && (
          <IconBtn label="Iniciar execução" onClick={() => run(() => saveTask({ ...t, status: "em_execucao" }), "Actividade em execução")}>
            <Play className="h-4 w-4" />
          </IconBtn>
        )}
        {t.status !== "concluida" && (
          <IconBtn label="Registar execução" onClick={() => setConcluding(t)}>
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          </IconBtn>
        )}
        {t.status === "concluida" && (
          <IconBtn label="Fiscalizar" onClick={() => setInspecting(t)}>
            <ClipboardCheck className="h-4 w-4 text-navy-700" />
          </IconBtn>
        )}
        <IconBtn label="Editar" onClick={() => setEditing(t)}>
          <Pencil className="h-4 w-4" />
        </IconBtn>
        <IconBtn label="Eliminar" danger onClick={() => setDeleting(t)}>
          <Trash2 className="h-4 w-4" />
        </IconBtn>
      </div>
    ) : null;

  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));

  return (
    <>
      <PageHeader
        eyebrow="Operações"
        title={config.title}
        description={canManage ? config.description : `${config.description} Consulta — gerido pelo Gestor Operacional.`}
        actions={
          canManage && (
            <Button onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" /> Nova actividade
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="De" className="sm:w-44">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Até" className="sm:w-44">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <div className="flex gap-2">
          {[
            { l: "± 14 dias", f: addDays(today, -14), t: addDays(today, 14) },
            { l: "Últimos 30 dias", f: addDays(today, -30), t: today },
            { l: "Ano", f: `${today.slice(0, 4)}-01-01`, t: `${today.slice(0, 4)}-12-31` },
          ].map((p) => (
            <Button key={p.l} size="sm" variant={from === p.f && to === p.t ? "primary" : "outline"} onClick={() => { setFrom(p.f); setTo(p.t); }}>
              {p.l}
            </Button>
          ))}
        </div>
        <DemoDataNote className="sm:ml-auto">Equipas e actividades de demonstração</DemoDataNote>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard index={0} label="Previstas até hoje" value={m.due} icon={ListChecks} />
        <StatCard index={1} label="Concluídas" value={m.done} icon={CheckCircle2} tone="success" />
        <StatCard index={2} label="Atrasadas" value={m.delayed} icon={Clock} tone="danger" />
        <StatCard index={3} label="Programadas" value={m.scheduled} icon={CalendarDays} tone="navy" />
        <StatCard index={4} highlight label="Cumprimento do plano" value={`${(m.compliance * 100).toFixed(0)}%`} icon={Gauge} />
        {isMaint ? (
          <StatCard index={5} label="Custo efectivo" value={formatKz(kpi.maintenance.actualCost)} icon={Wallet} tone="gold" hint={`${formatKz(kpi.maintenance.estimatedOpen)} previstos em aberto`} />
        ) : (
          <StatCard index={5} label="Conformidade" value={`${(m.conformity * 100).toFixed(0)}%`} icon={ClipboardCheck} tone="gold" hint={`${m.inspected} fiscalizadas`} />
        )}
      </div>

      <Tabs
        className="mb-4"
        value={view}
        onChange={setView}
        tabs={[
          { id: "plano", label: isMaint ? "Plano de manutenção" : "Plano e execução", count: rows.length },
          { id: "calendario", label: "Calendário operacional" },
          { id: "fiscalizacao", label: "Fiscalização", count: toInspect.length },
        ]}
      />

      {view === "plano" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
          <Card className="xl:col-span-3">
            <Toolbar>
              <SearchInput value={q} onChange={setQ} placeholder="Actividade, local, responsável…" className="sm:w-64" />
              <div className="grid grid-cols-3 gap-2 sm:flex">
                <Select value={state} onChange={(e) => setState(e.target.value as StateFilter)} className="sm:w-36" aria-label="Estado">
                  <option value="">Estados</option>
                  <option value="programada">Programadas</option>
                  <option value="em_execucao">Em execução</option>
                  <option value="concluida">Concluídas</option>
                  <option value="atrasada">Atrasadas</option>
                </Select>
                <Select value={type} onChange={(e) => setType(e.target.value)} className="sm:w-48" aria-label="Tipo">
                  <option value="">Tipos</option>
                  {config.types.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
                <Select value={team} onChange={(e) => setTeam(e.target.value)} className="sm:w-52" aria-label="Responsável">
                  <option value="">Responsáveis</option>
                  {config.teams.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </div>
            </Toolbar>
            <DataTable
              rows={rows}
              rowKey={(t) => t.id}
              pageSize={12}
              onRowClick={canManage ? (t) => setEditing(t) : undefined}
              columns={[
                {
                  key: "title",
                  header: "Actividade",
                  primary: true,
                  cell: (t) => (
                    <span>
                      <span className="block font-medium text-navy-900">{t.title}</span>
                      <span className="block text-xs text-graphite-500">{t.type}{t.frequency ? ` · ${t.frequency}` : ""}</span>
                    </span>
                  ),
                },
                { key: "loc", header: isMaint ? "Equipamento / local" : "Área", cell: (t) => (isMaint && t.equipment ? `${t.equipment} · ${t.location}` : t.location), hideOnMobile: true },
                { key: "resp", header: "Responsável", cell: (t) => t.responsible.replace(" (demo)", "") },
                { key: "date", header: "Prevista", cell: (t) => formatDate(t.scheduledDate, { day: "2-digit", month: "2-digit", year: "numeric" }) },
                { key: "exec", header: "Execução", cell: (t) => (t.executedDate ? formatDate(t.executedDate, { day: "2-digit", month: "2-digit" }) : "—") },
                ...(isMaint ? [{ key: "cost", header: "Custo", align: "right" as const, cell: (t: OpsTask) => <span className="tabular-nums">{t.actualCost ? formatKz(t.actualCost) : t.estimatedCost ? `≈ ${formatKz(t.estimatedCost)}` : "—"}</span>, hideOnMobile: true }] : []),
                {
                  key: "state",
                  header: "Estado",
                  cell: (t) => (
                    <span className="flex flex-wrap gap-1">
                      <StatusBadge status={taskState(t, today)} />
                      {t.inspection && <StatusBadge status={t.inspection.result} />}
                    </span>
                  ),
                },
                { key: "actions", header: "", align: "right", cell: (t) => actions(t) },
              ]}
            />
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader title="Indicadores" description="Período seleccionado" />
              <CardBody className="space-y-4">
                <Progress label="Execução do plano" value={m.compliance} />
                <Progress label="Conformidade (fiscalização)" value={m.conformity} hint={`${m.inspected} inspecções`} />
                {isMaint && <Progress label="Preventivas concluídas" value={kpi.maintenance.preventive ? kpi.maintenance.preventiveDone / kpi.maintenance.preventive : 1} />}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Por tipo" />
              <CardBody>{byType.length ? <HBars data={byType} height={Math.max(150, byType.length * 34)} /> : <p className="text-sm text-graphite-500">Sem dados.</p>}</CardBody>
            </Card>
          </div>
        </div>
      )}

      {view === "calendario" && (
        <Card>
          <CardHeader
            title={`Semana de ${formatDate(week, { day: "numeric", month: "long" })}`}
            action={
              <div className="flex gap-1">
                <IconBtn label="Semana anterior" onClick={() => setWeek(addDays(week, -7))}>
                  <ChevronLeft className="h-4 w-4" />
                </IconBtn>
                <Button size="sm" variant="outline" onClick={() => setWeek(mondayOf(today))}>
                  Hoje
                </Button>
                <IconBtn label="Semana seguinte" onClick={() => setWeek(addDays(week, 7))}>
                  <ChevronRight className="h-4 w-4" />
                </IconBtn>
              </div>
            }
          />
          <div className="grid grid-cols-1 divide-y divide-graphite-100 md:grid-cols-7 md:divide-x md:divide-y-0">
            {days.map((d) => {
              const list = tasks.filter((t) => t.scheduledDate === d);
              return (
                <div key={d} className={cn("min-h-40 p-2", d === today && "bg-gold-50/50")}>
                  <p className={cn("mb-2 text-xs font-semibold", d === today ? "text-gold-700" : "text-graphite-500")}>
                    {formatDate(d, { weekday: "short", day: "2-digit", month: "2-digit" })}
                  </p>
                  <ul className="space-y-1.5">
                    {list.map((t) => {
                      const st = taskState(t, today);
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => (canManage ? (t.status === "concluida" ? setInspecting(t) : setConcluding(t)) : undefined)}
                            className={cn(
                              "w-full rounded-lg border-l-4 bg-white px-2 py-1.5 text-left text-[11px] shadow-soft",
                              st === "concluida" ? "border-emerald-500" : st === "atrasada" ? "border-red-500" : st === "em_execucao" ? "border-sky-500" : "border-navy-400",
                            )}
                            title={t.title}
                          >
                            <span className="line-clamp-2 font-medium text-navy-900">{t.location}</span>
                            <span className="block text-graphite-500">{t.type}</span>
                          </button>
                        </li>
                      );
                    })}
                    {list.length === 0 && <li className="text-[11px] text-graphite-300">—</li>}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="border-t border-graphite-100 px-4 py-2 text-[11px] text-graphite-500">Verde: concluída · azul: em execução · cinza-azulado: programada · vermelho: atrasada</p>
        </Card>
      )}

      {view === "fiscalizacao" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="A fiscalizar" description="Actividades executadas sem registo de fiscalização" />
            <DataTable
              rows={toInspect}
              rowKey={(t) => t.id}
              pageSize={8}
              emptyTitle="Sem actividades por fiscalizar"
              columns={[
                { key: "t", header: "Actividade", primary: true, cell: (t) => <span className="font-medium text-navy-900">{t.title}</span> },
                { key: "r", header: "Responsável", cell: (t) => t.responsible.replace(" (demo)", "") },
                { key: "d", header: "Executada", cell: (t) => (t.executedDate ? formatDate(t.executedDate) : "—") },
                { key: "a", header: "", align: "right", cell: (t) => (canManage ? <Button size="sm" variant="subtle" onClick={() => setInspecting(t)}>Fiscalizar</Button> : null) },
              ]}
            />
          </Card>
          <Card>
            <CardHeader title="Registo de fiscalização" description={`${inspected.length} inspecções`} />
            <DataTable
              rows={inspected}
              rowKey={(t) => t.id}
              pageSize={8}
              columns={[
                { key: "t", header: "Actividade", primary: true, cell: (t) => <span className="font-medium text-navy-900">{t.title}</span> },
                { key: "res", header: "Resultado", cell: (t) => <StatusBadge status={t.inspection!.result} /> },
                { key: "n", header: "Observações", cell: (t) => t.inspection!.notes ?? "—", hideOnMobile: true },
                { key: "at", header: "Data", cell: (t) => formatDateTime(t.inspection!.at) },
              ]}
            />
          </Card>
        </div>
      )}

      {editing && <TaskForm config={config} task={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {concluding && <ConcludeForm task={concluding} isMaint={isMaint} onClose={() => setConcluding(null)} />}
      {inspecting && <InspectForm task={inspecting} canManage={canManage} onClose={() => setInspecting(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Eliminar actividade?"
        description={deleting?.title}
        confirmLabel="Eliminar"
        onConfirm={() => deleting && run(() => deleteTask(deleting.id), "Actividade eliminada")}
      />
    </>
  );
}

function TaskForm({ config, task, onClose }: { config: OpsModuleConfig; task: OpsTask | null; onClose: () => void }) {
  const saveTask = useDemoStore((s) => s.saveOpsTask);
  const isMaint = config.area === "manutencao";
  const [title, setTitle] = useState(task?.title ?? "");
  const [type, setType] = useState(task?.type ?? config.types[0]);
  const [location, setLocation] = useState(task?.location ?? config.locations[0]);
  const [block, setBlock] = useState(task?.block ?? "");
  const [responsible, setResponsible] = useState(task?.responsible ?? config.teams[0]);
  const [frequency, setFrequency] = useState<NonNullable<OpsTask["frequency"]>>(task?.frequency ?? (isMaint ? "Pontual" : "Semanal"));
  const [date, setDate] = useState(task?.scheduledDate ?? todayISO());
  const [due, setDue] = useState(task?.dueDate ?? "");
  const [equipment, setEquipment] = useState(task?.equipment ?? "");
  const [cost, setCost] = useState(task?.estimatedCost ? String(task.estimatedCost) : "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [repeat, setRepeat] = useState(false);

  const save = () => {
    if (title.trim().length < 3 && location.trim().length < 2) return toast.error("Indique a actividade e o local.");
    const base: OpsTask = {
      id: task?.id ?? uid("ops"),
      area: config.area,
      type,
      title: title.trim() || `${type} — ${location}`,
      location: location.trim(),
      block: block || undefined,
      responsible: responsible.trim() || "A definir",
      frequency,
      scheduledDate: date,
      dueDate: due || undefined,
      equipment: equipment.trim() || undefined,
      estimatedCost: cost ? Number(cost.replace(/\D/g, "")) : undefined,
      status: task?.status ?? "programada",
      executedDate: task?.executedDate,
      actualCost: task?.actualCost,
      inspection: task?.inspection,
      notes: notes.trim() || undefined,
    };
    try {
      saveTask(base);
      let extra = 0;
      if (!task && repeat && REPEAT[frequency]) {
        for (let i = 1; i < REPEAT[frequency].n; i++) {
          saveTask({ ...base, id: uid("ops"), scheduledDate: addDays(date, i * REPEAT[frequency].days), dueDate: due ? addDays(due, i * REPEAT[frequency].days) : undefined });
          extra++;
        }
      }
      toast.success(task ? "Actividade actualizada" : `Actividade criada${extra ? ` (+${extra} no plano)` : ""}`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg" title={task ? "Editar actividade" : "Nova actividade"} footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={save}>Guardar</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Actividade" className="sm:col-span-2" hint="Vazio = tipo + local">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Tipo">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {config.types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label={isMaint ? "Local / infraestrutura" : "Área comum"}>
          <Input list={`loc-${config.area}`} value={location} onChange={(e) => setLocation(e.target.value)} />
          <datalist id={`loc-${config.area}`}>
            {config.locations.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </Field>
        {isMaint && (
          <Field label="Equipamento">
            <Input value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="Ex.: Bombas da piscina" />
          </Field>
        )}
        <Field label="Bloco">
          <Select value={block} onChange={(e) => setBlock(e.target.value)}>
            <option value="">—</option>
            {BLOCKS.map((b) => (
              <option key={b} value={b}>
                Bloco {b}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={isMaint ? "Prestador / responsável" : "Responsável"}>
          <Input list={`team-${config.area}`} value={responsible} onChange={(e) => setResponsible(e.target.value)} />
          <datalist id={`team-${config.area}`}>
            {config.teams.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        <Field label="Frequência">
          <Select value={frequency} onChange={(e) => setFrequency(e.target.value as NonNullable<OpsTask["frequency"]>)}>
            {FREQUENCIES.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </Select>
        </Field>
        <Field label="Data prevista">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {isMaint && (
          <>
            <Field label="Prazo">
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
            <Field label="Custo previsto (Kz)" hint="Opcional">
              <Input inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} />
            </Field>
          </>
        )}
        <Field label="Observações" className="sm:col-span-2">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {!task && REPEAT[frequency] && (
          <label className="flex items-center gap-2 text-xs text-graphite-700 sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 accent-navy-900" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
            Gerar plano: {REPEAT[frequency].n} ocorrências ({frequency.toLowerCase()})
          </label>
        )}
      </div>
    </Modal>
  );
}

function ConcludeForm({ task, isMaint, onClose }: { task: OpsTask; isMaint: boolean; onClose: () => void }) {
  const saveTask = useDemoStore((s) => s.saveOpsTask);
  const [date, setDate] = useState(todayISO());
  const [cost, setCost] = useState(task.estimatedCost ? String(task.estimatedCost) : "");
  const [notes, setNotes] = useState(task.notes ?? "");
  const save = () => {
    try {
      saveTask({ ...task, status: "concluida", executedDate: date, actualCost: isMaint && cost ? Number(cost.replace(/\D/g, "")) : task.actualCost, notes: notes.trim() || undefined });
      toast.success("Execução registada", { description: isMaint && cost ? "O custo passa a constar nas despesas do dashboard financeiro." : "Indicadores actualizados." });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <Modal open onClose={onClose} title="Registar execução" description={task.title} footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={save}>Concluir actividade</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data de execução">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {isMaint && (
          <Field label="Custo efectivo (Kz)">
            <Input inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
        )}
        <Field label="Observações" className="sm:col-span-2">
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function InspectForm({ task, canManage, onClose }: { task: OpsTask; canManage: boolean; onClose: () => void }) {
  const saveTask = useDemoStore((s) => s.saveOpsTask);
  const session = useSession();
  const [result, setResult] = useState<"conforme" | "nao_conforme">(task.inspection?.result ?? "conforme");
  const [notes, setNotes] = useState(task.inspection?.notes ?? "");
  const save = () => {
    try {
      saveTask({ ...task, inspection: { result, notes: notes.trim() || undefined, by: session?.name ?? "Gestor Operacional", at: new Date().toISOString() } });
      toast.success(result === "conforme" ? "Fiscalização: serviço conforme" : "Fiscalização: serviço não conforme");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Fiscalização do serviço"
      description={`${task.title} · executada ${task.executedDate ? formatDate(task.executedDate) : "—"}`}
      footer={canManage ? <><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={save}>Registar fiscalização</Button></> : <Button variant="outline" onClick={onClose}>Fechar</Button>}
    >
      <div className="space-y-4">
        <p className="text-sm text-graphite-600">Responsável: {task.responsible}</p>
        {task.inspection && (
          <p className="text-xs text-graphite-500">
            Última fiscalização: <StatusBadge status={task.inspection.result} /> · {task.inspection.by} · {formatDateTime(task.inspection.at)}
          </p>
        )}
        {canManage && (
          <>
            <div className="flex gap-2">
              {(["conforme", "nao_conforme"] as const).map((r) => (
                <Button key={r} variant={result === r ? (r === "conforme" ? "primary" : "danger") : "outline"} onClick={() => setResult(r)}>
                  {r === "conforme" ? "Executado correctamente" : "Não conforme"}
                </Button>
              ))}
            </div>
            <Field label="Observações de fiscalização">
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: Escadas do 3.º piso por limpar." />
            </Field>
          </>
        )}
        {!canManage && <Badge>Consulta</Badge>}
      </div>
    </Modal>
  );
}
