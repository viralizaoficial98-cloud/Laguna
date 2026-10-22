"use client";

import { AlertTriangle, CircleDollarSign, Gauge, Landmark, Receipt, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CURRENT_PERIOD, useFinance } from "@/hooks/use-finance";
import { formatKz, formatKzCompact, parseQuarter } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { buttonClass } from "@/components/ui/button";
import { Donut, GroupedBars, MultiLine, SimpleBars } from "@/components/charts/charts";
import { PeriodFilter, periodLabel, previousPeriod, type PeriodValue } from "@/components/app/dashboards/period-filter";
import { RecentPayments } from "@/components/app/widgets/recent-payments";

export default function FinanceiroPage() {
  const cur = parseQuarter(CURRENT_PERIOD);
  const [period, setPeriod] = useState<PeriodValue>({ year: cur.year, quarter: 0 });
  const filter = { year: period.year, quarter: period.quarter || undefined, block: period.block };
  const f = useFinance(filter);
  const prev = previousPeriod(period);
  const fp = useFinance({ year: prev.year, quarter: prev.quarter || undefined, block: period.block });
  // evolução: sempre o ano seleccionado completo (respeitando o bloco)
  const yearly = useFinance({ year: period.year, block: period.block });
  const label = `${periodLabel(period)}${period.block ? ` · Bloco ${period.block}` : ""}`;
  // tendências apenas na vista trimestral (o ano anterior só tem dados parciais na demonstração)
  const trend = (a: number, b: number, goodWhenUp = true) => (period.quarter && b ? { value: ((a - b) / b) * 100, goodWhenUp } : null);
  const blockView = !!period.block;

  return (
    <>
      <PageHeader
        eyebrow="Executivo"
        title="Dashboard financeiro"
        description="Análise das quotas trimestrais, cobrança, despesas e resultado do condomínio."
        actions={
          <Link href="/painel/relatorios" className={buttonClass("primary")}>
            Relatório financeiro (PDF)
          </Link>
        }
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PeriodFilter value={period} onChange={setPeriod} years={f.years} withBlock />
        <DemoDataNote>{label} · valores de demonstração</DemoDataNote>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard index={0} label="Receita prevista" value={formatKz(f.expected)} icon={Receipt} trend={trend(f.expected, fp.expected)} hint="vs. anterior" />
        <StatCard index={1} highlight label="Receita recebida" value={formatKz(f.received)} icon={CircleDollarSign} trend={trend(f.received, fp.received)} hint="vs. anterior" />
        <StatCard index={2} label="Montante em dívida" value={formatKz(f.debt)} icon={AlertTriangle} tone="warning" trend={trend(f.debt, fp.debt, false)} hint={`${f.overdueCount} quotas em atraso`} />
        <StatCard index={3} label="Taxa de cobrança" value={`${(f.collectionRate * 100).toFixed(1)}%`} icon={Gauge} tone="success" hint={`${f.paidCount} quotas pagas`} />
        <StatCard index={4} label="Despesas totais" value={formatKz(f.expensesTotal)} icon={Wallet} tone="danger" trend={trend(f.expensesTotal, fp.expensesTotal, false)} hint={blockView ? "do condomínio (não imputadas por bloco)" : "vs. anterior"} />
        <StatCard index={5} label="Resultado financeiro" value={blockView ? "—" : formatKz(f.result)} icon={Landmark} tone={f.result >= 0 || blockView ? "success" : "danger"} hint={blockView ? "disponível sem filtro de bloco" : "recebido − despesas"} />
        <StatCard index={6} label="Evolução das receitas" value={trend(f.received, fp.received) ? `${trend(f.received, fp.received)!.value.toFixed(1)}%` : "—"} icon={TrendingUp} tone="info" hint={period.quarter ? "face ao trimestre anterior" : "seleccione um trimestre"} />
        <StatCard index={7} label="Evolução das despesas" value={trend(f.expensesTotal, fp.expensesTotal) ? `${trend(f.expensesTotal, fp.expensesTotal)!.value.toFixed(1)}%` : "—"} icon={TrendingDown} tone="gold" hint={period.quarter ? "face ao trimestre anterior" : "seleccione um trimestre"} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Receitas previstas vs. recebidas" description={`Por trimestre · ${period.year}${period.block ? ` · Bloco ${period.block}` : ""}`} />
          <CardBody>
            <GroupedBars data={yearly.quarterly} series={[{ key: "prevista", label: "Prevista" }, { key: "recebida", label: "Recebida" }]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Evolução das receitas e despesas" description={`Por trimestre · ${period.year} (despesas globais do condomínio)`} />
          <CardBody>
            <MultiLine data={yearly.quarterly} series={[{ key: "recebida", label: "Receitas recebidas" }, { key: "despesas", label: "Despesas" }]} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Despesas por categoria" description={periodLabel(period)} />
          <CardBody>
            {f.expensesByCategory.length ? (
              <Donut data={f.expensesByCategory} valueFormat={formatKzCompact} centerValue={`${(f.expensesTotal / 1_000_000).toFixed(1)} M`} centerLabel="Kz" />
            ) : (
              <p className="text-sm text-graphite-500">Sem despesas no período.</p>
            )}
            <ul className="mt-4 space-y-1 text-xs text-graphite-500">
              {f.expensesByCategory.map((c) => (
                <li key={c.key} className="flex justify-between">
                  <span>{c.label}</span>
                  <span className="tabular-nums">{formatKz(c.value)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Dívida acumulada por bloco" description={`Quotas pendentes e em atraso · ${periodLabel(period)}`} />
          <CardBody>
            <SimpleBars data={f.byBlock} dataKey="divida" label="Dívida" currency colorFor={() => "#b8873a"} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Taxa de pagamento por bloco" description={`Quotas pagas / emitidas · ${periodLabel(period)}`} />
          <CardBody>
            <SimpleBars data={f.byBlock} dataKey="taxa" label="Taxa de pagamento (%)" percent colorFor={(v) => (v >= 90 ? "#15803d" : v >= 75 ? "#2e5a9c" : v >= 60 ? "#d97706" : "#dc2626")} />
            <p className="mt-2 text-[11px] text-graphite-400">Verde ≥ 90% · azul ≥ 75% · laranja ≥ 60% · vermelho &lt; 60%</p>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Análise por bloco" description={periodLabel(period)} />
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-graphite-100 bg-graphite-50/70 text-[11px] tracking-wider text-graphite-500 uppercase">
                <th className="px-4 py-3 text-left">Bloco</th>
                <th className="px-4 py-3 text-right">Quotas emitidas</th>
                <th className="px-4 py-3 text-right">Pagas</th>
                <th className="px-4 py-3 text-right">Dívida</th>
                <th className="px-4 py-3 text-left">Taxa de pagamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-100">
              {f.byBlock.map((b) => (
                <tr key={b.block} className="hover:bg-navy-50/30">
                  <td className="px-4 py-2.5 font-medium text-navy-900">Bloco {b.block}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{b.total}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{b.pagas}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatKz(b.divida)}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-28 overflow-hidden rounded-full bg-graphite-100">
                        <span className="block h-full rounded-full bg-navy-500" style={{ width: `${b.taxa}%` }} />
                      </span>
                      <span className="text-xs tabular-nums">{b.taxa}%</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6">
        <RecentPayments />
      </div>
    </>
  );
}
