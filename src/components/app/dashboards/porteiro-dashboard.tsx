"use client";

import { CalendarClock, DoorOpen, PartyPopper, User, UserCheck, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Session } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { useVisitRows } from "@/hooks/use-visits";
import { formatDate, formatTime, todayISO } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { VisitDetailModal } from "@/components/app/widgets/visit-detail-modal";
import { Welcome } from "./welcome";

export function PorteiroDashboard({ session }: { session: Session }) {
  const today = todayISO();
  const rows = useVisitRows((v) => v.status === "autorizada");
  const accessLogs = useDemoStore((s) => s.accessLogs);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const todays = rows.filter((v) => v.date === today).sort((a, b) => a.time.localeCompare(b.time));
  const upcomingGroups = rows.filter((v) => v.kind === "grupo" && v.date > today).sort((a, b) => a.date.localeCompare(b.date));
  const guestsToday = todays.reduce((a, v) => a + v.guests.length, 0);
  const inside = rows.reduce((a, v) => a + v.inside, 0);
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <>
      <Welcome name={session.name} subtitle={`${session.title} · consulta de autorizações e confirmação de entradas`} image="/images/laguna/fachadas/entrada-principal.webp">
        <Link href="/painel/portaria" className={buttonClass("gold", "lg")}>
          <DoorOpen className="h-4 w-4" /> Visitantes autorizados
        </Link>
      </Welcome>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} label="Autorizações para hoje" value={todays.length} icon={CalendarClock} />
        <StatCard index={1} label="Pessoas esperadas hoje" value={guestsToday} icon={Users} tone="info" />
        <StatCard index={2} label="No interior" value={inside} icon={UserCheck} tone="success" />
        <StatCard index={3} label="Eventos de grupo próximos" value={upcomingGroups.length} icon={PartyPopper} tone="gold" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Visitas autorizadas para hoje" description="Registadas pelos moradores" action={<Link href="/painel/portaria" className="text-xs font-medium text-navy-700">Ver todas</Link>} />
          {todays.length === 0 ? (
            <EmptyState title="Sem visitas autorizadas para hoje" />
          ) : (
            <ul className="divide-y divide-graphite-100">
              {todays.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${v.kind === "grupo" ? "bg-violet-50 text-violet-700" : "bg-navy-50 text-navy-700"}`}>
                      {v.kind === "grupo" ? <PartyPopper className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-navy-900">{v.kind === "grupo" ? `${v.eventName} · ${v.guests.length} convidados` : v.guests[0]?.name}</p>
                      <p className="text-xs text-graphite-500">
                        Bloco {v.block} · Apart. {v.number} · {v.residentName} · {v.time}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={v.inside ? "info" : "neutral"}>
                      {v.inside}/{v.guests.length} dentro
                    </Badge>
                    <Button size="sm" variant="subtle" onClick={() => setSelectedId(v.id)}>
                      Confirmar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Próximos eventos de grupo" />
          {upcomingGroups.length === 0 ? (
            <p className="px-5 py-6 text-sm text-graphite-500">Sem eventos agendados.</p>
          ) : (
            <ul className="divide-y divide-graphite-100">
              {upcomingGroups.slice(0, 5).map((v) => (
                <li key={v.id}>
                  <button onClick={() => setSelectedId(v.id)} className="w-full px-5 py-3 text-left hover:bg-graphite-50">
                    <p className="text-sm font-medium text-navy-900">{v.eventType}: {v.eventName}</p>
                    <p className="text-xs text-graphite-500">
                      {formatDate(v.date)} · Bloco {v.block} · Apart. {v.number} · {v.guests.length} convidados
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Últimos acessos" action={<Link href="/painel/acessos" className="text-xs font-medium text-navy-700">Histórico</Link>} />
        <ul className="divide-y divide-graphite-100">
          {accessLogs.slice(0, 6).map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <span className="min-w-0 truncate">
                <span className={a.type === "entrada" ? "text-emerald-700" : "text-graphite-500"}>{a.type === "entrada" ? "↘ Entrada" : "↗ Saída"}</span> · <span className="font-medium text-navy-900">{a.person}</span>
              </span>
              <span className="shrink-0 text-xs text-graphite-500 tabular-nums">
                {formatDate(a.at, { day: "2-digit", month: "2-digit" })} {formatTime(a.at)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <VisitDetailModal visit={selected} onClose={() => setSelectedId(null)} />
    </>
  );
}
