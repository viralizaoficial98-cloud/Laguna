"use client";

import { DoorOpen, PartyPopper, Users } from "lucide-react";
import { useState } from "react";
import { useDemoStore } from "@/store/demo-store";
import { formatDate, formatDateTime, todayISO } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Reservation } from "@/types";

/**
 * Portaria — consulta (só leitura) de eventos confirmados nos salões e de saídas autorizadas.
 * A Portaria não altera nem aprova reservas ou processos de desocupação.
 */
export function PortariaEvents() {
  const reservations = useDemoStore((s) => s.reservations);
  const halls = useDemoStore((s) => s.halls);
  const residents = useDemoStore((s) => s.residents);
  const apartments = useDemoStore((s) => s.apartments);
  const moveOuts = useDemoStore((s) => s.moveOuts);
  const [open, setOpen] = useState<Reservation | null>(null);
  const today = todayISO();
  const events = reservations.filter((r) => r.status === "confirmada" && r.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const exits = moveOuts.filter((m) => m.status === "autorizada" || m.status === "concluida").sort((a, b) => b.plannedDate.localeCompare(a.plannedDate));
  const apt = (id: string) => apartments.find((a) => a.id === id);

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title="Eventos em salões" description="Reservas confirmadas — apenas consulta" action={<PartyPopper className="h-4 w-4 text-graphite-400" />} />
        <ul className="divide-y divide-graphite-100" data-testid="portaria-events">
          {events.map((r) => {
            const a = apt(r.apartmentId);
            return (
              <li key={r.id}>
                <button onClick={() => setOpen(r)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm hover:bg-navy-50/30">
                  <span>
                    <span className="font-medium text-navy-900">
                      {r.date === today ? "Hoje" : formatDate(r.date, { weekday: "short", day: "2-digit", month: "short" })} · {r.startTime}–{r.endTime} · {halls.find((h) => h.id === r.hallId)?.name}
                    </span>
                    <span className="block text-xs text-graphite-500">
                      {r.eventName} · {residents.find((x) => x.id === r.residentId)?.name} · Bloco {a?.block} · {a?.number}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-xs text-graphite-500">
                    <Users className="h-3.5 w-3.5" /> {r.guests.length || r.expectedGuests}
                  </span>
                </button>
              </li>
            );
          })}
          {!events.length && <li className="px-5 py-6 text-sm text-graphite-400">Sem eventos confirmados.</li>}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Saídas autorizadas" description="Autorizações administrativas de saída — apenas consulta" action={<DoorOpen className="h-4 w-4 text-graphite-400" />} />
        <ul className="divide-y divide-graphite-100" data-testid="portaria-exits">
          {exits.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <span>
                <span className="font-medium text-navy-900">
                  {m.residentName} · Bloco {m.block} · {m.number}
                </span>
                <span className="block text-xs text-graphite-500">
                  Processo {m.reference} · saída prevista {formatDate(m.plannedDate)}
                  {m.authorization ? ` · autorizado por ${m.authorization.by} em ${formatDateTime(m.authorization.at)}` : ""}
                </span>
              </span>
              <StatusBadge status={m.status} />
            </li>
          ))}
          {!exits.length && <li className="px-5 py-6 text-sm text-graphite-400">Sem saídas autorizadas.</li>}
        </ul>
      </Card>
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.eventName} description={open ? `${halls.find((h) => h.id === open.hallId)?.name} · ${formatDate(open.date)} · ${open.startTime}–${open.endTime}` : ""}>
        {open && (
          <div className="space-y-3 text-sm">
            <p>
              Morador: <strong>{residents.find((x) => x.id === open.residentId)?.name}</strong> · Bloco {apt(open.apartmentId)?.block} · {apt(open.apartmentId)?.number}
            </p>
            <p>Convidados previstos: {open.expectedGuests}</p>
            <ul className="max-h-60 space-y-1 overflow-auto">
              {open.guests.map((g) => (
                <li key={g.id} className="rounded-lg bg-graphite-50 px-3 py-1.5">
                  {g.name}
                </li>
              ))}
              {!open.guests.length && <li className="text-xs text-graphite-400">Lista de convidados não indicada.</li>}
            </ul>
          </div>
        )}
      </Modal>
    </div>
  );
}
