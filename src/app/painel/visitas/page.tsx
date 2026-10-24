"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, Eye, PartyPopper, Plus, Trash2, User, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type { Visit } from "@/types";
import { useDemoStore, formatApt } from "@/store/demo-store";
import { useCurrentResident } from "@/hooks/use-session";
import { useVisitRows, type VisitRow } from "@/hooks/use-visits";
import { cn, formatDate, todayISO, uid } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { VisitDetailModal } from "@/components/app/widgets/visit-detail-modal";

const dateRule = z.string().min(1, "Indique a data.").refine((d) => d >= todayISO(), "A data não pode ser anterior a hoje.");
const timeRule = z.string().regex(/^\d{2}:\d{2}$/, "Indique o horário previsto.");

const individualSchema = z.object({
  name: z.string().trim().min(3, "Indique o nome completo do visitante."),
  phone: z.string().optional(),
  date: dateRule,
  time: timeRule,
  notes: z.string().optional(),
});

const EVENT_TYPES = ["Aniversário", "Festa familiar", "Reunião", "Outro evento"] as const;
const groupSchema = z.object({
  eventName: z.string().trim().min(3, "Indique o nome ou a descrição do evento."),
  eventType: z.enum(EVENT_TYPES),
  date: dateRule,
  time: timeRule,
  notes: z.string().optional(),
  guests: z.array(z.object({ id: z.string(), name: z.string().trim().min(3, "Nome do convidado em falta.") })).min(2, "Adicione pelo menos 2 convidados."),
});

export default function VisitasPage() {
  const { resident, apartment } = useCurrentResident();
  const saveVisit = useDemoStore((s) => s.saveVisit);
  const cancelVisit = useDemoStore((s) => s.cancelVisit);
  const rows = useVisitRows((v) => v.residentId === resident?.id);
  const [tab, setTab] = useState<"proximas" | "historico">("proximas");
  const [form, setForm] = useState<"individual" | "grupo" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<VisitRow | null>(null);
  const today = todayISO();

  const list = rows
    .filter((v) => (tab === "proximas" ? v.date >= today && v.status === "autorizada" : v.date < today || v.status === "cancelada"))
    .sort((a, b) => (tab === "proximas" ? (a.date + a.time).localeCompare(b.date + b.time) : (b.date + b.time).localeCompare(a.date + a.time)));
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const save = (v: Omit<Visit, "id" | "residentId" | "apartmentId" | "status" | "createdAt" | "updatedAt">) => {
    if (!resident || !apartment) return;
    const now = new Date().toISOString();
    try {
      saveVisit({ ...v, id: uid("vis"), residentId: resident.id, apartmentId: apartment.id, status: "autorizada", createdAt: now, updatedAt: now });
      toast.success(v.kind === "grupo" ? `Grupo autorizado: ${v.guests.length} convidados` : `Visita autorizada: ${v.guests[0].name}`, {
        description: "Disponível de imediato na área da Portaria.",
      });
      setForm(null);
      setTab("proximas");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Minha área"
        title="Visitas"
        description={`Autorize visitas para ${apartment ? formatApt(apartment) : "a sua fracção"}. A Portaria confirma a entrada com base na sua autorização.`}
        actions={
          <>
            <Button variant="outline" onClick={() => setForm("individual")}>
              <UserPlus className="h-4 w-4" /> Visita individual
            </Button>
            <Button onClick={() => setForm("grupo")}>
              <PartyPopper className="h-4 w-4" /> Visita em grupo
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <button onClick={() => setForm("individual")} className="group flex items-start gap-4 rounded-2xl border border-graphite-100 bg-white p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-navy-50 text-navy-700 transition group-hover:bg-navy-900 group-hover:text-gold-300">
            <User className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-semibold text-navy-900">Visita individual</span>
            <span className="block text-sm text-graphite-500">Uma pessoa: nome, contacto, data e horário previsto.</span>
          </span>
        </button>
        <button onClick={() => setForm("grupo")} className="group flex items-start gap-4 rounded-2xl border border-graphite-100 bg-white p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 transition group-hover:bg-violet-700 group-hover:text-white">
            <Users className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-semibold text-navy-900">Visita em grupo</span>
            <span className="block text-sm text-graphite-500">Festas, aniversários e reuniões — vários convidados numa só autorização.</span>
          </span>
        </button>
      </div>

      <Card>
        <div className="border-b border-graphite-100 p-4">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "proximas", label: "Próximas", count: rows.filter((v) => v.date >= today && v.status === "autorizada").length },
              { id: "historico", label: "Histórico" },
            ]}
          />
        </div>
        {list.length === 0 ? (
          <EmptyState icon={UserPlus} title={tab === "proximas" ? "Sem visitas agendadas" : "Sem histórico"} description="Registe uma visita individual ou em grupo." />
        ) : (
          <ul className="divide-y divide-graphite-100">
            {list.map((v) => (
              <li key={v.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", v.kind === "grupo" ? "bg-violet-50 text-violet-700" : "bg-navy-50 text-navy-700")}>
                    {v.kind === "grupo" ? <PartyPopper className="h-5 w-5" /> : <User className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-navy-900">{v.kind === "grupo" ? v.eventName : v.guests[0]?.name}</p>
                    <p className="text-xs text-graphite-500">
                      {formatDate(v.date)} · {v.time}
                      {v.kind === "grupo" && ` · ${v.eventType} · ${v.guests.length} convidados`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {v.kind === "grupo" ? <Badge tone="violet">Grupo</Badge> : <Badge tone="navy">Individual</Badge>}
                  {v.status === "cancelada" ? <StatusBadge status="cancelada" /> : v.inside + v.left > 0 ? <Badge tone="info">{v.inside + v.left} entrada(s) confirmada(s)</Badge> : <StatusBadge status="autorizada" />}
                  <Button size="sm" variant="ghost" onClick={() => setSelectedId(v.id)}>
                    <Eye className="h-3.5 w-3.5" /> Ver
                  </Button>
                  {v.status === "autorizada" && v.date >= today && v.inside + v.left === 0 && (
                    <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setCancelling(v)}>
                      <Ban className="h-3.5 w-3.5" /> Cancelar
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <IndividualForm open={form === "individual"} onClose={() => setForm(null)} onSave={save} />
      <GroupForm open={form === "grupo"} onClose={() => setForm(null)} onSave={save} />
      <VisitDetailModal visit={selected} onClose={() => setSelectedId(null)} />
      <ConfirmDialog
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        title="Cancelar esta autorização?"
        description="A Portaria deixará de poder confirmar a entrada destas pessoas."
        confirmLabel="Cancelar autorização"
        onConfirm={() => {
          if (!cancelling) return;
          try {
            cancelVisit(cancelling.id);
            toast.success("Autorização cancelada.");
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    </>
  );
}

type SaveFn = (v: Omit<Visit, "id" | "residentId" | "apartmentId" | "status" | "createdAt" | "updatedAt">) => void;

function IndividualForm({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: SaveFn }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof individualSchema>>({ resolver: zodResolver(individualSchema), defaultValues: { name: "", phone: "", date: todayISO(), time: "", notes: "" } });
  const close = () => {
    reset();
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title="Visita individual"
      description="O registo fica associado automaticamente à sua fracção."
      footer={
        <>
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" form="ind-form">
            Autorizar visita
          </Button>
        </>
      }
    >
      <form
        id="ind-form"
        noValidate
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={handleSubmit((d) => {
          onSave({ kind: "individual", date: d.date, time: d.time, notes: d.notes || undefined, guests: [{ id: uid("gst"), name: d.name.trim(), phone: d.phone?.trim() || undefined }] });
          reset();
        })}
      >
        <Field label="Nome completo do visitante" required error={errors.name?.message} className="sm:col-span-2">
          <Input {...register("name")} invalid={!!errors.name} autoComplete="off" />
        </Field>
        <Field label="Contacto telefónico" hint="Opcional" className="sm:col-span-2">
          <Input type="tel" {...register("phone")} placeholder="+244" />
        </Field>
        <Field label="Data da visita" required error={errors.date?.message}>
          <Input type="date" min={todayISO()} {...register("date")} invalid={!!errors.date} />
        </Field>
        <Field label="Horário previsto" required error={errors.time?.message}>
          <Input type="time" {...register("time")} invalid={!!errors.time} />
        </Field>
        <Field label="Observações" hint="Opcional" className="sm:col-span-2">
          <Textarea rows={3} {...register("notes")} />
        </Field>
      </form>
    </Modal>
  );
}

function GroupForm({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: SaveFn }) {
  const [newGuest, setNewGuest] = useState("");
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof groupSchema>>({
    resolver: zodResolver(groupSchema),
    defaultValues: { eventName: "", eventType: "Aniversário", date: todayISO(), time: "", notes: "", guests: [] },
  });
  const guests = useFieldArray({ control, name: "guests" });
  const close = () => {
    reset();
    setNewGuest("");
    onClose();
  };
  const add = () => {
    const names = newGuest
      .split(/\n|;/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    names.forEach((n) => guests.append({ id: uid("gst"), name: n }));
    setNewGuest("");
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title="Visita em grupo"
      description="Festas, aniversários, reuniões e outros eventos — uma única autorização para todos os convidados."
      footer={
        <>
          <span className="mr-auto self-center text-sm text-graphite-600">
            Total: <strong className="text-navy-900">{guests.fields.length}</strong> convidados
          </span>
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" form="grp-form">
            Confirmar autorização do grupo
          </Button>
        </>
      }
    >
      <form
        id="grp-form"
        noValidate
        onSubmit={handleSubmit((d) => {
          onSave({ kind: "grupo", eventName: d.eventName.trim(), eventType: d.eventType, date: d.date, time: d.time, notes: d.notes || undefined, guests: d.guests.map((g) => ({ id: g.id, name: g.name.trim() })) });
          reset();
        })}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome / descrição do evento" required error={errors.eventName?.message} className="sm:col-span-2">
            <Input {...register("eventName")} placeholder="Ex.: Aniversário da Sofia" invalid={!!errors.eventName} />
          </Field>
          <Field label="Tipo de evento">
            <Select {...register("eventType")}>
              {EVENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data" required error={errors.date?.message}>
              <Input type="date" min={todayISO()} {...register("date")} invalid={!!errors.date} />
            </Field>
            <Field label="Horário" required error={errors.time?.message}>
              <Input type="time" {...register("time")} invalid={!!errors.time} />
            </Field>
          </div>
          <Field label="Observações" hint="Opcional" className="sm:col-span-2">
            <Textarea rows={2} {...register("notes")} />
          </Field>
        </div>

        <div className="mt-5 rounded-2xl border border-graphite-100 p-4">
          <p className="mb-2 text-sm font-semibold text-navy-900">Convidados</p>
          <div className="flex gap-2">
            <Input
              value={newGuest}
              onChange={(e) => setNewGuest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="Nome do convidado (Enter para adicionar)"
              aria-label="Nome do convidado"
            />
            <Button variant="subtle" onClick={add}>
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-graphite-400">Dica: cole vários nomes separados por “;” para os adicionar de uma vez.</p>
          {errors.guests?.message && <p className="mt-2 text-xs text-red-600">{errors.guests.message}</p>}
          {guests.fields.length > 0 && (
            <ol className="mt-3 max-h-64 divide-y divide-graphite-100 overflow-y-auto rounded-xl border border-graphite-100">
              {guests.fields.map((f, i) => (
                <li key={f.id} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="w-6 text-right text-xs text-graphite-400 tabular-nums">{i + 1}.</span>
                  <Input {...register(`guests.${i}.name`)} invalid={!!errors.guests?.[i]?.name} className="h-9 border-transparent bg-transparent hover:border-graphite-200" />
                  <button type="button" onClick={() => guests.remove(i)} className="rounded-lg p-1.5 text-graphite-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remover convidado ${i + 1}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </form>
    </Modal>
  );
}
