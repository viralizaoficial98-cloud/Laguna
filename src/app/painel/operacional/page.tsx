"use client";

import { ArrowUpDown, CheckCircle2, Clock, Hammer, ShieldAlert, Sparkles, Timer, Trees, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CURRENT_PERIOD } from "@/hooks/use-finance";
import { useOperations } from "@/hooks/use-operations";
import { formatDate, parseQuarter } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import { DataTable } from "@/components/ui/data-table";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Donut, GroupedBars, HBars } from "@/components/charts/charts";
import { ElevatorGrid } from "@/components/app/widgets/elevator-grid";
import { OpsAlerts } from "@/components/app/widgets/ops-alerts";
import { PeriodFilter, periodLabel, periodRange, type PeriodValue } from "@/components/app/dashboards/period-filter";

const AREA: Record<string, string> = { limpeza: "Limpeza", jardinagem: "Jardinagem", manutencao: "Manutenção" };

/** Supervisão operacional — consulta do Administrador sobre os registos do Gestor Operacional. */
export default function OperacionalPage() {
  const cur = parseQuarter(CURRENT_PERIOD);
  const [period, setPeriod] = useState<PeriodValue>({ year: cur.year, quarter: cur.quarter });
  const ops = useOperations({ ...periodRange(period), block: period.block });
  const live = useOperations({ block: period.block });
  const label = `${periodLabel(period)}${period.block ? ` · Bloco ${period.block}` : ""}`;

  return (
    <>
      <PageHeader
        eyebrow="Executivo"
        title="Supervisão operacional"
        description="Elevadores, ocorrências, limpeza, jardinagem e manutenção — registados por Nelson Rodrigues, Gestor Operacional."
        actions={
          <Link href="/painel/relatorios" className={buttonClass("primary")}>
            Relatório operacional (PDF)
          </Link>
        }
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PeriodFilter value={period} onChange={setPeriod} years={[cur.year - 1, cur.year]} withBlock />
        <DemoDataNote>{label} · dados de demonstração</DemoDataNote>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard index={0} label="Ocorrências abertas (agora)" value={live.occurrences.open} icon={ShieldAlert} tone="warning" hint={`${live.occurrences.urgent} urgentes`} />
        <StatCard index={1} label="Tempo médio de resolução" value={`${ops.occurrences.avgResolutionDays.toFixed(1)} dias`} icon={Timer} tone="info" hint={`${ops.occurrences.resolved} resolvidas no período`} />
        <StatCard index={2} label="Tarefas atrasadas (agora)" value={live.delayedTasks.length} icon={Clock} tone="danger" hint="limpeza, jardinagem e manutenção" />
        <StatCard index={3} highlight label="Cumprimento do plano" value={`${(ops.planCompliance * 100).toFixed(0)}%`} icon={CheckCircle2} hint={label} />
        <StatCard index={4} label="Limpeza executada" value={`${ops.cleaning.done}/${ops.cleaning.due}`} icon={Sparkles} tone="navy" hint={`conformidade ${(ops.cleaning.conformity * 100).toFixed(0)}%`} />
        <StatCard index={5} label="Jardinagem executada" value={`${ops.gardening.done}/${ops.gardening.due}`} icon={Trees} tone="success" hint={`conformidade ${(ops.gardening.conformity * 100).toFixed(0)}%`} />
        <StatCard index={6} label="Manutenções preventivas" value={`${ops.maintenance.preventiveDone}/${ops.maintenance.preventive}`} icon={Wrench} tone="gold" hint="concluídas / previstas" />
        <StatCard index={7} label="Manutenções correctivas" value={`${ops.maintenance.correctiveDone}/${ops.maintenance.corrective}`} icon={Hammer} tone="warning" hint="concluídas / registadas" />
      </div>

      <Card className="mt-6">
        <CardHeader title="Estado dos elevadores" description="Inventário de demonstração — a configurar pelo Gestor" action={<Link href="/painel/elevadores" className="text-xs font-medium text-navy-700"><ArrowUpDown className="mr-1 inline h-3.5 w-3.5" />Histórico</Link>} />
        <CardBody>
          <ElevatorGrid elevators={live.elevators.list} />
        </CardBody>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Ocorrências por bloco" description={label} />
          <CardBody>
            <GroupedBars data={ops.occurrences.byBlock} currency={false} series={[{ key: "abertas", label: "Abertas" }, { key: "resolvidas", label: "Resolvidas" }]} height={240} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Ocorrências por gravidade" description={label} />
          <CardBody>
            <Donut data={ops.occurrences.byPriority.map((p) => ({ key: p.key, label: p.key === "media" ? "Média" : p.key[0].toUpperCase() + p.key.slice(1), value: p.value }))} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Eficiência operacional" description={label} />
          <CardBody className="space-y-5">
            <Progress label="Limpeza — execução" value={ops.cleaning.compliance} />
            <Progress label="Jardinagem — execução" value={ops.gardening.compliance} />
            <Progress label="Manutenção — execução" value={ops.maintenance.compliance} />
            <Progress label="Fiscalização — conformidade" value={(ops.cleaning.conformity + ops.gardening.conformity) / 2} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Desempenho das equipas" description="% de actividades executadas" />
          <CardBody>
            <HBars data={ops.teams.map((t) => ({ label: t.team.replace(" (demo)", "").replace("Prestador de ", ""), value: t.rate }))} height={Math.max(200, ops.teams.length * 34)} />
          </CardBody>
        </Card>
        <OpsAlerts />
      </div>

      <Card className="mt-6">
        <CardHeader title="Tarefas atrasadas" description="Situação actual" />
        <DataTable
          rows={live.delayedTasks.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))}
          rowKey={(t) => t.id}
          pageSize={8}
          emptyTitle="Sem tarefas atrasadas"
          columns={[
            { key: "title", header: "Actividade", primary: true, cell: (t) => <span className="font-medium text-navy-900">{t.title}</span> },
            { key: "area", header: "Área", cell: (t) => <Badge tone="navy">{AREA[t.area]}</Badge> },
            { key: "resp", header: "Responsável", cell: (t) => t.responsible },
            { key: "date", header: "Previsto", cell: (t) => formatDate(t.dueDate ?? t.scheduledDate) },
            { key: "st", header: "Estado", cell: () => <Badge tone="danger">Atrasada</Badge> },
          ]}
        />
      </Card>
    </>
  );
}
