"use client";

import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Gauge,
  Landmark,
  Percent,
  Receipt,
  ShieldAlert,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Session } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { CURRENT_PERIOD, useFinance } from "@/hooks/use-finance";
import { useOperations } from "@/hooks/use-operations";
import { BLOCKS } from "@/data/management";
import { formatKz, parseQuarter } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { buttonClass } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Donut, GroupedBars } from "@/components/charts/charts";
import { PendingPayments } from "@/components/app/widgets/pending-payments";
import { OpsAlerts } from "@/components/app/widgets/ops-alerts";
import { Welcome } from "./welcome";
import { PeriodFilter, periodLabel, periodRange, previousPeriod, type PeriodValue } from "./period-filter";

function pctChange(now: number, before: number) {
  return before ? ((now - before) / before) * 100 : null;
}

/** Centro de comando executivo — José Leiria, Administrador do Condomínio. */
export function ExecutiveDashboard({ session }: { session: Session }) {
  const cur = parseQuarter(CURRENT_PERIOD);
  const [period, setPeriod] = useState<PeriodValue>({ year: cur.year, quarter: cur.quarter });
  const apartments = useDemoStore((s) => s.apartments);
  const residents = useDemoStore((s) => s.residents);
  const f = useFinance({ year: period.year, quarter: period.quarter || undefined });
  const prev = previousPeriod(period);
  const fPrev = useFinance({ year: prev.year, quarter: prev.quarter || undefined });
  const range = periodRange(period);
  const ops = useOperations(range);
  const opsNow = useOperations();

  const active = useMemo(() => apartments.filter((a) => a.active), [apartments]);
  const occupied = active.filter((a) => a.status === "ocupado").length;
  const label = periodLabel(period);
  // comparação apenas entre trimestres (o ano anterior tem dados parciais na demonstração)
  const cmp = (a: number, b: number) => (period.quarter ? pctChange(a, b) : null);

  return (
    <>
      <Welcome name={session.name} subtitle="Administrador do Condomínio · centro de comando executivo do Residencial Laguna">
        <div className="flex flex-wrap gap-2">
          <Link href="/painel/financeiro" className={buttonClass("gold")}>
            <BarChart3 className="h-4 w-4" /> Dashboard financeiro
          </Link>
          <Link href="/painel/relatorios" className={buttonClass("outline", "md", "border-white/20 bg-white/5 text-white hover:bg-white/10")}>
            Relatórios PDF
          </Link>
        </div>
      </Welcome>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PeriodFilter value={period} onChange={setPeriod} years={f.years} />
        <DemoDataNote>Período: {label} · dados de demonstração</DemoDataNote>
      </div>

      <h2 className="mb-3 text-xs font-semibold tracking-[0.2em] text-graphite-400 uppercase">Condomínio</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard index={0} label="Total de apartamentos" value={active.length} icon={Building2} hint={`${apartments.filter((a) => a.provisional).length} em cadastro provisório`} />
        <StatCard index={1} label="Total de moradores" value={residents.length} icon={Users} tone="info" hint={`${residents.filter((r) => r.status === "activo").length} activos`} />
        <StatCard index={2} label="Taxa de ocupação" value={`${active.length ? Math.round((occupied / active.length) * 100) : 0}%`} icon={Percent} tone="navy" hint={`${occupied} fracções ocupadas`} />
        <StatCard index={3} label="Total de blocos" value={BLOCKS.length} icon={Landmark} tone="gold" hint="Blocos 01 a 10" />
      </div>

      <h2 className="mt-6 mb-3 text-xs font-semibold tracking-[0.2em] text-graphite-400 uppercase">Financeiro · {label}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard index={4} label="Receita prevista" value={formatKz(f.expected)} icon={Receipt} hint="quotas trimestrais emitidas" />
        <StatCard index={5} highlight label="Receita recebida" value={formatKz(f.received)} icon={CircleDollarSign} trend={(() => { const v = cmp(f.received, fPrev.received); return v === null ? null : { value: v }; })()} hint="vs. período anterior" />
        <StatCard index={6} label="Valor em dívida" value={formatKz(f.debt)} icon={AlertTriangle} tone="warning" hint={`${f.overdueCount} em atraso · ${f.pendingCount} pendentes`} />
        <StatCard index={7} label="Taxa de cobrança" value={`${(f.collectionRate * 100).toFixed(1)}%`} icon={Gauge} tone="success" trend={period.quarter && fPrev.collectionRate ? { value: (f.collectionRate - fPrev.collectionRate) * 100 } : null} hint="pontos percentuais" />
        <StatCard index={8} label="Despesas operacionais" value={formatKz(f.expensesTotal)} icon={Wallet} tone="danger" trend={(() => { const v = cmp(f.expensesTotal, fPrev.expensesTotal); return v === null ? null : { value: v, goodWhenUp: false }; })()} hint="vs. anterior" />
        <StatCard index={9} label="Saldo financeiro" value={formatKz(f.result)} icon={Landmark} tone={f.result >= 0 ? "success" : "danger"} hint="recebido − despesas" />
      </div>

      <h2 className="mt-6 mb-3 text-xs font-semibold tracking-[0.2em] text-graphite-400 uppercase">Operacional</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard index={10} label="Ocorrências abertas" value={opsNow.occurrences.open} icon={ShieldAlert} tone="warning" hint={`${opsNow.occurrences.urgent} urgentes (agora)`} />
        <StatCard index={11} label="Ocorrências resolvidas" value={ops.occurrences.resolved} icon={CheckCircle2} tone="success" hint={label} />
        <StatCard index={12} label="Elevadores operacionais" value={`${opsNow.elevators.operacional}/${opsNow.elevators.total}`} icon={ArrowUpDown} tone="success" hint="inventário de demonstração" />
        <StatCard index={13} label="Elevadores avariados" value={opsNow.elevators.avariado} icon={ArrowUpDown} tone="danger" hint={`${opsNow.elevators.em_manutencao} em manutenção`} />
        <StatCard index={14} label="Manutenções pendentes" value={opsNow.maintenance.pending} icon={Wrench} tone="gold" hint={`${opsNow.maintenance.delayed} atrasadas`} />
        <StatCard index={15} label="Cumprimento do plano" value={`${(ops.planCompliance * 100).toFixed(0)}%`} icon={ClipboardCheck} tone="navy" hint="actividades executadas / previstas" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Receitas previstas vs. recebidas" description={`Por trimestre · ${period.year}`} action={<Link href="/painel/financeiro" className="text-xs font-medium text-navy-700">Análise financeira</Link>} />
          <CardBody>
            <GroupedBars data={f.quarterly.map((q) => ({ ...q, label: q.label }))} series={[{ key: "prevista", label: "Prevista" }, { key: "recebida", label: "Recebida" }]} />
          </CardBody>
        </Card>
        <OpsAlerts />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Estado dos elevadores" description="Actualizado pelo Gestor Operacional" action={<Link href="/painel/elevadores" className="text-xs font-medium text-navy-700">Detalhe</Link>} />
          <CardBody>
            <Donut
              data={[
                { key: "operacional", label: "Operacionais", value: opsNow.elevators.operacional },
                { key: "em_manutencao", label: "Em manutenção", value: opsNow.elevators.em_manutencao },
                { key: "avariado", label: "Avariados", value: opsNow.elevators.avariado },
                { key: "fora_servico", label: "Fora de serviço", value: opsNow.elevators.fora_servico },
              ]}
              centerValue={String(opsNow.elevators.total)}
              centerLabel="elevadores"
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Execução dos serviços" description={label} action={<Link href="/painel/operacional" className="text-xs font-medium text-navy-700">Supervisão</Link>} />
          <CardBody className="space-y-5">
            <Progress label="Plano de limpeza" value={ops.cleaning.compliance} hint={`${ops.cleaning.done} de ${ops.cleaning.due} actividades previstas`} />
            <Progress label="Plano de jardinagem" value={ops.gardening.compliance} hint={`${ops.gardening.done} de ${ops.gardening.due} actividades previstas`} />
            <Progress label="Manutenção" value={ops.maintenance.compliance} hint={`${ops.maintenance.done} de ${ops.maintenance.due} intervenções previstas`} />
            <Progress label="Conformidade na fiscalização" value={(ops.cleaning.conformity + ops.gardening.conformity) / 2} hint="limpeza e jardinagem inspeccionadas" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Ocorrências por gravidade" description={label} action={<Activity className="h-4 w-4 text-graphite-400" />} />
          <CardBody>
            <Donut data={ops.occurrences.byPriority.map((p) => ({ key: p.key, label: p.key === "media" ? "Média" : p.key[0].toUpperCase() + p.key.slice(1), value: p.value }))} centerValue={`${ops.occurrences.avgResolutionDays.toFixed(1)} d`} centerLabel="resolução média" />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <PendingPayments />
      </div>
    </>
  );
}
