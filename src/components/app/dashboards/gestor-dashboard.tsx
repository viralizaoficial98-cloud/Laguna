"use client";

import { ArrowUpDown, CalendarClock, CheckCircle2, ClipboardList, Clock, ShieldAlert, Siren, Sparkles, Trees, Wrench } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import type { Session } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { taskState, useOperations } from "@/hooks/use-operations";
import { formatDate, todayISO } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { Donut, HBars, MultiLine } from "@/components/charts/charts";
import { ElevatorGrid } from "@/components/app/widgets/elevator-grid";
import { OpsAlerts } from "@/components/app/widgets/ops-alerts";
import { Welcome } from "./welcome";

const AREA: Record<string, string> = { limpeza: "Limpeza", jardinagem: "Jardinagem", manutencao: "Manutenção" };

function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Centro de operações — Nelson Rodrigues, Gestor Operacional. */
export function GestorDashboard({ session }: { session: Session }) {
  const ops = useOperations();
  const tasks = useDemoStore((s) => s.opsTasks);
  const today = todayISO();
  const last30 = useOperations({ from: addDays(today, -30), to: today });

  const weekly = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const end = addDays(today, -7 * (7 - i));
      const start = addDays(end, -6);
      const rate = (area: string) => {
        const list = tasks.filter((t) => t.area === area && t.scheduledDate >= start && t.scheduledDate <= end && t.scheduledDate <= today);
        return list.length ? Math.round((list.filter((t) => t.status === "concluida").length / list.length) * 100) : undefined;
      };
      return { label: formatDate(end, { day: "2-digit", month: "2-digit" }), limpeza: rate("limpeza"), jardinagem: rate("jardinagem") };
    });
  }, [tasks, today]);

  const upcoming = tasks
    .filter((t) => t.status !== "concluida" && t.scheduledDate >= today && t.scheduledDate <= addDays(today, 7) && !(t.area === "limpeza" && t.frequency === "Diária"))
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
    .slice(0, 8);

  const maintenanceStatus = (["programada", "em_execucao", "atrasada", "concluida"] as const).map((s) => ({
    key: s,
    label: s === "programada" ? "Programadas" : s === "em_execucao" ? "Em execução" : s === "atrasada" ? "Atrasadas" : "Concluídas",
    value: tasks.filter((t) => t.area === "manutencao" && taskState(t, today) === s).length,
  }));

  return (
    <>
      <Welcome name={session.name} subtitle="Gestor Operacional · centro de operações do Residencial Laguna" image="/images/laguna/lazer/piscina-e-deck.webp">
        <div className="flex flex-wrap gap-2">
          <Link href="/painel/ocorrencias?nova=1" className={buttonClass("gold")}>
            <ShieldAlert className="h-4 w-4" /> Registar ocorrência
          </Link>
          <Link href="/painel/elevadores" className={buttonClass("outline", "md", "border-white/20 bg-white/5 text-white hover:bg-white/10")}>
            <ArrowUpDown className="h-4 w-4" /> Elevadores
          </Link>
        </div>
      </Welcome>
      <div className="mb-3 flex justify-end">
        <DemoDataNote>Situação actual · actividades concluídas nos últimos 30 dias</DemoDataNote>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard index={0} label="Total de elevadores" value={ops.elevators.total} icon={ArrowUpDown} hint="inventário configurável" />
        <StatCard index={1} label="Em funcionamento" value={ops.elevators.operacional} icon={CheckCircle2} tone="success" />
        <StatCard index={2} label="Avariados" value={ops.elevators.avariado} icon={Siren} tone="danger" hint={`${ops.elevators.fora_servico} fora de serviço`} />
        <StatCard index={3} label="Em manutenção" value={ops.elevators.em_manutencao} icon={Wrench} tone="warning" />
        <StatCard index={4} label="Ocorrências abertas" value={ops.occurrences.open} icon={ShieldAlert} tone="warning" />
        <StatCard index={5} label="Ocorrências urgentes" value={ops.occurrences.urgent} icon={Siren} tone="danger" />
        <StatCard index={6} label="Ocorrências resolvidas" value={last30.occurrences.resolved} icon={CheckCircle2} tone="success" hint="últimos 30 dias" />
        <StatCard index={7} label="Manutenções programadas" value={ops.maintenance.scheduled} icon={CalendarClock} tone="navy" />
        <StatCard index={8} label="Manutenções atrasadas" value={ops.maintenance.delayed} icon={Clock} tone="danger" />
        <StatCard index={9} label="Limpezas concluídas" value={last30.cleaning.done} icon={Sparkles} tone="info" hint={`${(last30.cleaning.compliance * 100).toFixed(0)}% do plano (30 dias)`} />
        <StatCard index={10} label="Jardinagem concluída" value={last30.gardening.done} icon={Trees} tone="success" hint={`${(last30.gardening.compliance * 100).toFixed(0)}% do plano (30 dias)`} />
        <StatCard index={11} highlight label="Tarefas pendentes" value={ops.pendingTasks} icon={ClipboardList} hint={`${ops.delayedTasks.length} atrasadas`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Cumprimento semanal do plano" description="% de actividades executadas · últimas 8 semanas" />
          <CardBody>
            <MultiLine data={weekly} percent currency={false} series={[{ key: "limpeza", label: "Limpeza" }, { key: "jardinagem", label: "Jardinagem" }]} height={250} />
          </CardBody>
        </Card>
        <OpsAlerts />
      </div>

      <Card className="mt-6">
        <CardHeader title="Elevadores" description="Clique em Elevadores para actualizar o estado ou registar intervenções" action={<Link href="/painel/elevadores" className="text-xs font-medium text-navy-700">Gerir</Link>} />
        <CardBody>
          <ElevatorGrid elevators={ops.elevators.list} />
        </CardBody>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Ocorrências por categoria" description="Histórico completo" />
          <CardBody>
            <HBars data={ops.occurrences.byCategory} height={260} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Manutenção" description="Estado das intervenções" />
          <CardBody>
            <Donut data={maintenanceStatus} centerValue={String(maintenanceStatus.reduce((a, s) => a + s.value, 0))} centerLabel="intervenções" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Produtividade das equipas" description="% de actividades executadas" />
          <CardBody>
            <HBars data={ops.teams.map((t) => ({ label: t.team.replace(" (demo)", "").replace("Prestador de ", ""), value: t.rate }))} height={260} />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Próximas actividades" description="Próximos 7 dias (excluindo limpeza diária)" />
        {upcoming.length === 0 ? (
          <p className="px-5 py-6 text-sm text-graphite-500">Sem actividades programadas.</p>
        ) : (
          <ul className="divide-y divide-graphite-100">
            {upcoming.map((t) => (
              <li key={t.id}>
                <Link href={`/painel/${t.area}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-graphite-50">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-navy-900">{t.title}</span>
                    <span className="block text-xs text-graphite-500">{t.responsible}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge tone="navy">{AREA[t.area]}</Badge>
                    <span className="text-xs text-graphite-600 tabular-nums">{formatDate(t.scheduledDate)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
