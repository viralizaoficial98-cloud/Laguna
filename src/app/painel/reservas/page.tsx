"use client";

import { CalendarCheck2, CalendarClock, CircleDollarSign, Hourglass, PartyPopper, Plus, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Hall, Reservation } from "@/types";
import { useDemoStore, aptLabel, RESERVATION_CONFLICT_MSG } from "@/store/demo-store";
import { useSession } from "@/hooks/use-session";
import { can } from "@/config/permissions";
import { formatDate, formatDateTime, formatKz, todayISO, uid } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { HallCalendar, dayState, DAY_LABEL } from "@/components/app/reservations/hall-calendar";
import { ReservationDetail } from "@/components/app/reservations/reservation-detail";

const EVENT_TYPES = ["Aniversário", "Festa familiar", "Reunião", "Celebração religiosa", "Evento social", "Outro"];
type TabId = "calendario" | "minhas" | "validacao" | "todas" | "configuracao";

export default function ReservasPage() {
  const session = useSession();
  const role = session?.role;
  const halls = useDemoStore((s) => s.halls);
  const reservations = useDemoStore((s) => s.reservations);
  const apartments = useDemoStore((s) => s.apartments);
  const residents = useDemoStore((s) => s.residents);
  const expire = useDemoStore((s) => s.expireReservations);
  const isResident = can(role, "reservations.request");
  const validator = can(role, "reservations.validate");
  const admin = can(role, "halls.manage");

  // reservas provisórias não pagas expiram automaticamente (prazo configurável)
  useEffect(() => {
    const n = expire();
    if (n) toast.info(`${n} reserva(s) provisória(s) expirada(s) — datas libertadas.`);
  }, [expire]);

  const [tab, setTab] = useState<TabId>(isResident ? "calendario" : validator ? "validacao" : "todas");
  const [detail, setDetail] = useState<string | null>(null);
  const activeHalls = halls.filter((h) => h.active);
  const [hallId, setHallId] = useState(activeHalls[0]?.id ?? "");

  const mine = reservations.filter((r) => r.residentId === session?.residentId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const pendingValidation = reservations.filter((r) => r.status === "em_validacao");
  const all = [...reservations].sort((a, b) => b.date.localeCompare(a.date));
  const confirmedRevenue = reservations.filter((r) => r.status === "confirmada").reduce((a, r) => a + r.fee, 0);

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "calendario", label: isResident ? "Calendário e pedido" : "Calendário" },
    ...(isResident ? [{ id: "minhas" as const, label: "As minhas reservas", count: mine.length }] : []),
    ...(validator ? [{ id: "validacao" as const, label: "Validação de pagamentos", count: pendingValidation.length }] : []),
    ...(!isResident ? [{ id: "todas" as const, label: "Todas as reservas" }] : []),
    ...(admin ? [{ id: "configuracao" as const, label: "Configuração" }] : []),
  ];

  const columns = [
    { key: "date", header: "Data", primary: true, cell: (r: Reservation) => <span className="font-semibold text-navy-900">{formatDate(r.date)}</span> },
    { key: "hall", header: "Salão", cell: (r: Reservation) => halls.find((h) => h.id === r.hallId)?.name ?? "—" },
    { key: "ev", header: "Evento", cell: (r: Reservation) => r.eventName },
    { key: "res", header: "Morador", hideOnMobile: true, cell: (r: Reservation) => `${residents.find((x) => x.id === r.residentId)?.name ?? "—"} · ${aptLabel(apartments, r.apartmentId)}` },
    { key: "g", header: "Convidados", hideOnMobile: true, cell: (r: Reservation) => r.expectedGuests },
    { key: "fee", header: "Valor", align: "right" as const, cell: (r: Reservation) => formatKz(r.fee) },
    { key: "st", header: "Estado", cell: (r: Reservation) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Comunidade"
        title="Reservas de salões"
        description={
          isResident
            ? "Consulte a disponibilidade, solicite a reserva e envie o comprovativo de pagamento."
            : validator
              ? "Validação financeira dos pagamentos de reservas e consulta do calendário."
              : "Supervisão das reservas dos salões do condomínio."
        }
      />
      {!isResident && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard index={0} label="Confirmadas" value={reservations.filter((r) => r.status === "confirmada").length} icon={CalendarCheck2} tone="success" />
          <StatCard index={1} label="Em validação" value={pendingValidation.length} icon={Hourglass} tone="gold" />
          <StatCard index={2} label="Pendentes de pagamento" value={reservations.filter((r) => r.status === "pendente_pagamento").length} icon={CalendarClock} tone="warning" />
          <StatCard index={3} highlight label="Receita de reservas" value={formatKz(confirmedRevenue)} icon={CircleDollarSign} hint="reservas confirmadas" />
        </div>
      )}
      <Tabs value={tab} onChange={setTab} tabs={tabs} className="mb-5 w-fit max-w-full" />

      {tab === "calendario" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <Card>
            <CardHeader
              title="Disponibilidade"
              description="Cada salão tem o seu próprio calendário."
              action={
                activeHalls.length > 1 ? (
                  <Select value={hallId} onChange={(e) => setHallId(e.target.value)} aria-label="Salão" className="w-44">
                    {activeHalls.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </Select>
                ) : null
              }
            />
            <CardBody>{hallId ? <CalendarWithForm hallId={hallId} isResident={isResident} onOpen={setDetail} /> : <p className="text-sm text-graphite-500">Sem salões activos.</p>}</CardBody>
          </Card>
          <UpcomingList reservations={reservations.filter((r) => r.hallId === hallId && r.date >= todayISO() && ["confirmada", "em_validacao", "pendente_pagamento"].includes(r.status))} onOpen={setDetail} showNames={!isResident} />
        </div>
      )}

      {tab === "minhas" && (
        <Card>
          <DataTable rows={mine} rowKey={(r) => r.id} onRowClick={(r) => setDetail(r.id)} emptyTitle="Sem reservas" emptyDescription="Ainda não efectuou nenhum pedido de reserva." columns={[...columns.filter((c) => c.key !== "res"), { key: "exp", header: "Prazo", hideOnMobile: true, cell: (r: Reservation) => (r.status === "pendente_pagamento" && r.expiresAt ? `até ${formatDateTime(r.expiresAt)}` : "—") }]} />
        </Card>
      )}

      {tab === "validacao" && (
        <Card>
          <DataTable rows={pendingValidation} rowKey={(r) => r.id} onRowClick={(r) => setDetail(r.id)} emptyTitle="Sem pagamentos por validar" columns={columns} />
        </Card>
      )}

      {tab === "todas" && (
        <Card>
          <DataTable rows={all} rowKey={(r) => r.id} onRowClick={(r) => setDetail(r.id)} columns={columns} />
        </Card>
      )}

      {tab === "configuracao" && admin && <HallSettings />}

      <DemoDataNote className="mt-6">Uma reserva activa por salão e data — regra garantida pelo servidor e pela base de dados para todos os utilizadores.</DemoDataNote>
      <ReservationDetail id={detail} onClose={() => setDetail(null)} />
    </>
  );
}

function UpcomingList({ reservations, onOpen, showNames }: { reservations: Reservation[]; onOpen: (id: string) => void; showNames: boolean }) {
  const residents = useDemoStore((s) => s.residents);
  const list = [...reservations].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <Card>
      <CardHeader title="Próximas reservas" description="Datas ocupadas ou bloqueadas provisoriamente" />
      <ul className="divide-y divide-graphite-100">
        {list.map((r) => (
          <li key={r.id}>
            <button onClick={() => (showNames ? onOpen(r.id) : undefined)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm">
              <span>
                <span className="font-medium text-navy-900">{formatDate(r.date, { weekday: "short", day: "2-digit", month: "short" })}</span>
                <span className="block text-xs text-graphite-500">{showNames ? `${r.eventName} · ${residents.find((x) => x.id === r.residentId)?.name ?? ""}` : `${r.startTime}–${r.endTime}`}</span>
              </span>
              <StatusBadge status={r.status} />
            </button>
          </li>
        ))}
        {!list.length && <li className="px-5 py-6 text-sm text-graphite-400">Sem reservas futuras.</li>}
      </ul>
    </Card>
  );
}

function CalendarWithForm({ hallId, isResident, onOpen }: { hallId: string; isResident: boolean; onOpen: (id: string) => void }) {
  const reservations = useDemoStore((s) => s.reservations);
  const settings = useDemoStore((s) => s.settings);
  const request = useDemoStore((s) => s.requestReservation);
  const hall = useDemoStore((s) => s.halls.find((h) => h.id === hallId));
  const [date, setDate] = useState<string>();
  const [form, setForm] = useState({ eventType: EVENT_TYPES[0], eventName: "", expectedGuests: "20", startTime: "15:00", endTime: "21:00", notes: "", accept: false });
  const st = date ? dayState(reservations, hallId, date) : undefined;

  const submit = (waitlist = false) => {
    if (!date) return toast.error("Seleccione uma data no calendário.");
    if (!form.eventName.trim()) return toast.error("Indique o nome do evento.");
    if (!form.accept) return toast.error("Confirme as condições da reserva.");
    if (form.endTime <= form.startTime) return toast.error("O horário de fim deve ser posterior ao de início.");
    try {
      const r = request({ hallId, date, startTime: form.startTime, endTime: form.endTime, eventType: form.eventType, eventName: form.eventName.trim(), expectedGuests: Number(form.expectedGuests) || 0, guests: [], notes: form.notes.trim() || undefined }, { waitlist });
      toast.success(waitlist ? "Pedido registado em lista de espera" : "Reserva solicitada — envie o comprovativo de pagamento", { description: waitlist ? "Será notificado se a data ficar disponível." : `Data bloqueada provisoriamente durante ${settings.reservationHoldHours} h.` });
      setForm({ ...form, eventName: "", notes: "", accept: false });
      setDate(undefined);
      if (!waitlist) onOpen(r.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível reservar.");
    }
  };

  return (
    <>
      <HallCalendar reservations={reservations} hallId={hallId} selected={date} onSelect={isResident ? setDate : undefined} />
      {isResident && date && st && (
        <div className="mt-5 border-t border-graphite-100 pt-5" data-testid="reservation-form">
          <p className="text-sm font-semibold text-navy-900">
            {hall?.name} · {formatDate(date, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} — <span data-testid="date-state">{DAY_LABEL[st.state]}</span>
          </p>
          {st.state !== "disponivel" ? (
            <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="alert">
              {RESERVATION_CONFLICT_MSG}
              {st.state === "pendente" && <p className="mt-1 text-xs">A data está bloqueada provisoriamente. Pode registar o pedido em lista de espera — se a reserva actual expirar ou for cancelada, passa a ser o próximo.</p>}
            </div>
          ) : (
            <p className="mt-1 text-xs text-graphite-500">
              Valor da reserva: <strong>{formatKz(settings.reservationFee)}</strong> · a data fica bloqueada provisoriamente durante {settings.reservationHoldHours} h até à validação do pagamento.
            </p>
          )}
          {st.state !== "reservado" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Tipo de evento">
                <Select value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })}>
                  {EVENT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Nome do evento" required>
                <Input name="eventName" value={form.eventName} onChange={(e) => setForm({ ...form, eventName: e.target.value })} placeholder="Ex.: Aniversário da Ana" />
              </Field>
              <Field label="N.º de convidados" hint={hall?.capacity ? `Capacidade indicativa: ${hall.capacity}` : undefined}>
                <Input type="number" min={1} value={form.expectedGuests} onChange={(e) => setForm({ ...form, expectedGuests: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Início">
                  <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                </Field>
                <Field label="Fim">
                  <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                </Field>
              </div>
              <Field label="Observações" className="sm:col-span-2">
                <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>
              <label className="flex items-start gap-2 text-xs text-graphite-600 sm:col-span-2">
                <input type="checkbox" name="accept" checked={form.accept} onChange={(e) => setForm({ ...form, accept: e.target.checked })} className="mt-0.5" />
                Confirmo o pedido e tomo conhecimento do valor de {formatKz(settings.reservationFee)}, a pagar e validar pelo Gestor Financeiro para confirmação.
              </label>
              <div className="sm:col-span-2">
                {st.state === "disponivel" ? (
                  <Button onClick={() => submit(false)}>
                    <PartyPopper className="h-4 w-4" /> Solicitar reserva
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => submit(true)}>
                    Entrar em lista de espera
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function HallSettings() {
  const halls = useDemoStore((s) => s.halls);
  const settings = useDemoStore((s) => s.settings);
  const update = useDemoStore((s) => s.updateSettings);
  const saveHall = useDemoStore((s) => s.saveHall);
  const [fee, setFee] = useState(String(settings.reservationFee));
  const [hold, setHold] = useState(String(settings.reservationHoldHours));
  const [name, setName] = useState("");
  const sorted = useMemo(() => [...halls].sort((a, b) => a.name.localeCompare(b.name)), [halls]);
  const toggle = (h: Hall) => saveHall({ ...h, active: !h.active });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Condições da reserva" description="Definidas pela Administração" action={<Settings2 className="h-4 w-4 text-graphite-400" />} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor por reserva (Kz)">
            <Input type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} />
          </Field>
          <Field label="Prazo do bloqueio provisório (horas)">
            <Input type="number" min={1} value={hold} onChange={(e) => setHold(e.target.value)} />
          </Field>
          <Button
            className="sm:col-span-2 sm:w-fit"
            onClick={() => {
              try {
                update({ reservationFee: Number(fee), reservationHoldHours: Number(hold) });
                toast.success("Condições actualizadas (aplicam-se a novos pedidos).");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Erro");
              }
            }}
          >
            Guardar condições
          </Button>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Salões" description="O número de salões do condomínio está por confirmar." />
        <ul className="divide-y divide-graphite-100">
          {sorted.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <span>
                <span className="font-medium text-navy-900">{h.name}</span>
                {h.demo && <span className="ml-2 text-[11px] text-gold-700">registo de demonstração</span>}
              </span>
              <Button size="sm" variant="outline" onClick={() => toggle(h)}>
                {h.active ? "Desactivar" : "Activar"}
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 border-t border-graphite-100 p-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do novo salão" />
          <Button
            onClick={() => {
              if (!name.trim()) return;
              saveHall({ id: uid("hall"), name: name.trim(), active: true, demo: false });
              setName("");
              toast.success("Salão adicionado — calendário independente.");
            }}
          >
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>
      </Card>
    </div>
  );
}
