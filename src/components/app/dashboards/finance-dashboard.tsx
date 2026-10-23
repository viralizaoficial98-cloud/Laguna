"use client";

import { AlertTriangle, Building2, CheckCircle2, CircleDollarSign, Clock, Gauge, Hourglass, Landmark, PartyPopper, Receipt, TrendingDown, TrendingUp, Wallet, Wrench, XCircle } from "lucide-react";
import { useState } from "react";
import { CURRENT_PERIOD, useFinance } from "@/hooks/use-finance";
import { formatKz, formatKzCompact, parseQuarter } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { Donut, GroupedBars, MultiLine, SimpleBars, TrendArea } from "@/components/charts/charts";
import { PeriodFilter, periodLabel, previousPeriod, type PeriodValue } from "./period-filter";

/**
 * Dashboard financeiro (fonte única `useFinance`).
 * - full: Gestor Financeiro e Administração
 * - limited: Gestor Operacional (consulta limitada — cobrança agregada, sem dívidas nem despesas)
 */
export function FinanceDashboard({ mode = "full" }: { mode?: "full" | "limited" }) {
  const cur = parseQuarter(CURRENT_PERIOD);
  const [period, setPeriod] = useState<PeriodValue>({ year: cur.year, quarter: cur.quarter });
  const filter = { year: period.year, quarter: period.quarter || undefined, block: period.block, typology: period.typology };
  const f = useFinance(filter);
  const prev = previousPeriod(period);
  const fp = useFinance({ ...filter, year: prev.year, quarter: prev.quarter || undefined });
  const yearly = useFinance({ year: period.year, block: period.block, typology: period.typology });
  const label = `${periodLabel(period)}${period.block ? ` · Bloco ${period.block}` : ""}${period.typology ? ` · ${period.typology}` : ""}`;
  const trend = (a: number, b: number, goodWhenUp = true) => (period.quarter && b ? { value: ((a - b) / b) * 100, goodWhenUp } : null);
  const scopedView = !!period.block || !!period.typology;
  const pctTxt = (t: ReturnType<typeof trend>) => (t ? `${t.value >= 0 ? "+" : ""}${t.value.toFixed(1)}%` : "—");

  const filters = (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <PeriodFilter value={period} onChange={setPeriod} years={f.years} withBlock={mode === "full"} withTypology={mode === "full"} />
      <DemoDataNote>{label} · valores de demonstração</DemoDataNote>
    </div>
  );

  if (mode === "limited")
    return (
      <>
        {filters}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard index={0} label="Receita prevista" value={formatKz(f.expected)} icon={Receipt} />
          <StatCard index={1} highlight label="Receita cobrada" value={formatKz(f.received)} icon={CircleDollarSign} />
          <StatCard index={2} label="Taxa de cobrança" value={`${(f.collectionRate * 100).toFixed(1)}%`} icon={Gauge} tone="success" />
          <StatCard index={3} label="Comprovativos por validar" value={f.analysisCount} icon={Hourglass} tone="gold" />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Receitas previstas vs. cobradas" description={`Por trimestre · ${period.year}`} />
            <CardBody>
              <GroupedBars data={yearly.quarterly} series={[{ key: "prevista", label: "Prevista" }, { key: "recebida", label: "Cobrada" }]} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Taxa de cobrança por trimestre" description={String(period.year)} />
            <CardBody>
              <SimpleBars data={yearly.quarterly} dataKey="taxa" label="Taxa de cobrança (%)" percent />
            </CardBody>
          </Card>
        </div>
        <p className="mt-4 text-xs text-graphite-500">Consulta limitada: dívidas por fracção, despesas e saldo são acompanhados pelo Gestor Financeiro e pela Administração.</p>
      </>
    );

  return (
    <>
      {filters}
      <h2 className="mb-3 text-xs font-semibold tracking-[0.2em] text-graphite-400 uppercase">Receitas e cobrança · {label}</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard index={0} label="Receita prevista" value={formatKz(f.expected)} icon={Receipt} hint="quotas emitidas (T2 · Duplex)" />
        <StatCard index={1} highlight label="Receita recebida" value={formatKz(f.received)} icon={CircleDollarSign} trend={trend(f.received, fp.received)} hint="valores validados" />
        <StatCard index={2} label="Receita por cobrar" value={formatKz(f.pending)} icon={Clock} tone="info" hint={`${f.pendingCount} quotas no prazo`} />
        <StatCard index={3} label="Dívida acumulada (vencida)" value={formatKz(f.overdue)} icon={AlertTriangle} tone="warning" hint={`${f.overdueCount} quotas · ${f.arrearsCount} apartamentos`} />
        <StatCard index={4} label="Taxa de cobrança" value={`${(f.collectionRate * 100).toFixed(1)}%`} icon={Gauge} tone="success" hint={`${f.paidCount} pagas · ${f.partialCount} parciais`} />
        <StatCard index={5} label="Pendentes de validação" value={f.analysisCount} icon={Hourglass} tone="gold" hint={formatKz(f.analysis)} />
        <StatCard index={6} label="Pagamentos aprovados" value={f.approvedCount} icon={CheckCircle2} tone="success" hint="no período" />
        <StatCard index={7} label="Pagamentos rejeitados" value={f.rejectedCount} icon={XCircle} tone="danger" hint="no período" />
      </div>
      <h2 className="mt-6 mb-3 text-xs font-semibold tracking-[0.2em] text-graphite-400 uppercase">Despesas, reservas e saldo</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard index={8} label="Despesas operacionais" value={formatKz(f.operationalExpenses)} icon={Wallet} tone="danger" hint={scopedView ? "do condomínio (não imputadas)" : "limpeza, jardinagem, segurança…"} />
        <StatCard index={9} label="Despesas de manutenção" value={formatKz(f.maintenanceTotal)} icon={Wrench} tone="danger" hint="manutenção e elevadores" />
        <StatCard index={10} label="Receita de reservas" value={formatKz(f.reservationRevenue)} icon={PartyPopper} tone="gold" hint="salões — reservas confirmadas" />
        <StatCard index={11} label="Saldo financeiro" value={scopedView ? "—" : formatKz(f.result)} icon={Landmark} tone={f.result >= 0 || scopedView ? "success" : "danger"} hint={scopedView ? "disponível sem filtros de bloco/tipologia" : "recebido + reservas − despesas"} />
        <StatCard index={12} label="Evolução das receitas" value={pctTxt(trend(f.received, fp.received))} icon={TrendingUp} tone="info" hint={period.quarter ? "face ao trimestre anterior" : "seleccione um trimestre"} />
        <StatCard index={13} label="Evolução das despesas" value={pctTxt(trend(f.expensesTotal, fp.expensesTotal))} icon={TrendingDown} tone="gold" hint={period.quarter ? "face ao trimestre anterior" : "seleccione um trimestre"} />
        <StatCard index={14} label="Apartamentos em atraso" value={f.arrearsCount} icon={Building2} tone="warning" hint="com quotas vencidas por liquidar" />
        <StatCard index={15} label="Quotas parcialmente pagas" value={f.partialCount} icon={Receipt} tone="navy" hint="pagamentos parciais autorizados" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Receitas previstas vs. recebidas" description={`Por trimestre · ${period.year}`} />
          <CardBody>
            <GroupedBars data={yearly.quarterly} series={[{ key: "prevista", label: "Prevista" }, { key: "recebida", label: "Recebida" }]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Evolução trimestral das cobranças e despesas" description={String(period.year)} />
          <CardBody>
            <MultiLine data={yearly.quarterly} series={[{ key: "recebida", label: "Cobranças" }, { key: "despesas", label: "Despesas" }]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Dívidas por bloco" description={`Quotas vencidas por liquidar · ${periodLabel(period)}`} />
          <CardBody>
            <SimpleBars data={f.byBlock} dataKey="divida" label="Dívida vencida" currency colorFor={() => "#b8873a"} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Pagamentos por tipologia" description={`Prevista vs. recebida · ${periodLabel(period)}`} />
          <CardBody>
            <GroupedBars data={f.byTypology} series={[{ key: "prevista", label: "Prevista" }, { key: "recebida", label: "Recebida" }]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Distribuição das despesas" description={periodLabel(period)} />
          <CardBody>
            {f.expensesByCategory.length ? <Donut data={f.expensesByCategory} valueFormat={formatKzCompact} centerValue={`${(f.expensesTotal / 1_000_000).toFixed(1)} M`} centerLabel="Kz" /> : <p className="text-sm text-graphite-500">Sem despesas no período.</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Evolução do saldo" description={`Acumulado por trimestre · ${period.year}`} />
          <CardBody>
            <TrendArea data={yearly.quarterly} dataKey="saldo" label="Saldo acumulado" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Receita de reservas" description={`Por trimestre · ${period.year}`} />
          <CardBody>
            <SimpleBars data={yearly.quarterly} dataKey="reservas" label="Reservas" currency colorFor={() => "#9a5bc0"} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Taxa de cobrança por trimestre" description={String(period.year)} />
          <CardBody>
            <SimpleBars data={yearly.quarterly} dataKey="taxa" label="Taxa de cobrança (%)" percent colorFor={(v) => (v >= 90 ? "#15803d" : v >= 75 ? "#2e5a9c" : v >= 60 ? "#d97706" : "#dc2626")} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
