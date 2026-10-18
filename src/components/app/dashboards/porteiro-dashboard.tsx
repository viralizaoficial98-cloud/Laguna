"use client";

import { DoorOpen, LogIn, ShieldAlert, UserCheck, UserPlus, Clock } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { toast } from "sonner";
import type { Session } from "@/types";
import { useDemoStore, aptLabel } from "@/store/demo-store";
import { DEMO_TODAY } from "@/data/management";
import { formatTime } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TrendArea } from "@/components/charts/charts";
import { OccurrencesWidget } from "@/components/app/widgets/occurrences-widget";
import { Welcome } from "./welcome";

export function PorteiroDashboard({ session }: { session: Session }) {
  const visitors = useDemoStore((s) => s.visitors);
  const apartments = useDemoStore((s) => s.apartments);
  const accessLogs = useDemoStore((s) => s.accessLogs);
  const occurrences = useDemoStore((s) => s.occurrences);
  const checkout = useDemoStore((s) => s.checkoutVisitor);
  const saveVisitor = useDemoStore((s) => s.saveVisitor);

  const today = useMemo(() => visitors.filter((v) => v.entryAt.startsWith(DEMO_TODAY) || v.status === "no_interior" || v.status === "aguardando"), [visitors]);
  const inside = visitors.filter((v) => v.status === "no_interior");
  const waiting = visitors.filter((v) => v.status === "aguardando");

  const perDay = useMemo(() => {
    const days = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"];
    const base = [6, 9, 7, 11, 8, 12, 0];
    return days.map((d, i) => ({ label: d.slice(8) + "/10", visitas: base[i] + visitors.filter((v) => v.entryAt.startsWith(d)).length }));
  }, [visitors]);

  return (
    <>
      <Welcome name={session.name} subtitle={`${session.title} · Entrada principal`} image="/images/laguna/fachadas/entrada-principal.webp">
        <Link href="/painel/portaria?novo=1" className={buttonClass("gold", "lg")}>
          <UserPlus className="h-4 w-4" /> Registar visitante
        </Link>
      </Welcome>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} label="Visitantes hoje" value={today.length} icon={DoorOpen} />
        <StatCard index={1} label="No interior" value={inside.length} icon={UserCheck} tone="info" />
        <StatCard index={2} label="A aguardar autorização" value={waiting.length} icon={Clock} tone="warning" />
        <StatCard index={3} label="Ocorrências abertas" value={occurrences.filter((o) => o.status !== "resolvida").length} icon={ShieldAlert} tone="danger" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Visitantes no condomínio" description="Registos activos" action={<Link href="/painel/portaria" className="text-xs font-medium text-navy-700">Ver lista completa</Link>} />
          {inside.length + waiting.length === 0 ? (
            <EmptyState title="Sem visitantes no interior" />
          ) : (
            <ul className="divide-y divide-graphite-100">
              {[...waiting, ...inside].map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy-900">{v.name}</p>
                    <p className="text-xs text-graphite-500">
                      Destino {aptLabel(apartments, v.apartmentId)} · {v.reason} · entrada {formatTime(v.entryAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={v.status} />
                    {v.status === "aguardando" ? (
                      <Button
                        size="sm"
                        variant="subtle"
                        onClick={() => {
                          saveVisitor({ ...v, status: "no_interior", entryAt: new Date().toISOString() });
                          toast.success(`Entrada autorizada: ${v.name}`);
                        }}
                      >
                        <LogIn className="h-3.5 w-3.5" /> Autorizar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          checkout(v.id);
                          toast.success(`Saída registada: ${v.name}`);
                        }}
                      >
                        Registar saída
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Visitas por dia" description="Últimos 7 dias (demo)" />
          <CardBody>
            <TrendArea data={perDay} dataKey="visitas" label="Visitas" currency={false} height={220} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <OccurrencesWidget />
        <Card>
          <CardHeader title="Últimos acessos" action={<Link href="/painel/acessos" className="text-xs font-medium text-navy-700">Histórico</Link>} />
          <ul className="divide-y divide-graphite-100">
            {accessLogs.slice(0, 6).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="min-w-0 truncate">
                  <span className={a.type === "entrada" ? "text-emerald-700" : "text-graphite-500"}>{a.type === "entrada" ? "↘ Entrada" : "↗ Saída"}</span> · <span className="font-medium text-navy-900">{a.person}</span>
                </span>
                <span className="shrink-0 text-xs text-graphite-500 tabular-nums">{formatTime(a.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
