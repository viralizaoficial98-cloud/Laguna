"use client";

import { AlertTriangle, Banknote, CircleDollarSign, Clock, Hourglass, TrendingUp } from "lucide-react";
import { useFinance } from "@/hooks/use-finance";
import { formatKz } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { Donut, GroupedBars } from "@/components/charts/charts";
import { PendingPayments } from "@/components/app/widgets/pending-payments";
import { RecentPayments } from "@/components/app/widgets/recent-payments";

/** Dashboard financeiro — usado pelo perfil Financeiro e na "Visão financeira". */
export function FinanceOverview() {
  const f = useFinance();
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} highlight label="Total recebido" value={formatKz(f.received)} icon={CircleDollarSign} hint={`${f.paidCount} quotas aprovadas`} />
        <StatCard index={1} label="Total pendente" value={formatKz(f.pending)} icon={Clock} tone="info" hint={`${f.pendingCount} quotas por pagar`} />
        <StatCard index={2} label="Quotas em atraso" value={formatKz(f.overdue)} icon={AlertTriangle} tone="warning" hint={`${f.overdueCount} quotas vencidas`} />
        <StatCard index={3} label="Em análise" value={formatKz(f.analysis)} icon={Hourglass} tone="gold" hint={`${f.analysisCount} comprovativos`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Receitas mensais" description="Valor emitido vs. recebido por mês (Kz)" action={<DemoDataNote />} />
          <CardBody>
            <GroupedBars data={f.monthly} series={[{ key: "emitido", label: "Emitido" }, { key: "recebido", label: "Recebido" }]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Estado das quotas" description="Quotas vencidas até ao mês corrente" />
          <CardBody>
            <Donut useStatusColors data={f.statusCounts.map((s) => ({ key: s.status, value: s.count }))} centerValue={`${Math.round(f.collectionRate * 100)}%`} centerLabel="cobrança" />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Receitas trimestrais" description="Emitido vs. recebido (Kz)" />
          <CardBody>
            <GroupedBars data={f.quarters} series={[{ key: "emitido", label: "Emitido" }, { key: "recebido", label: "Recebido" }]} height={230} />
          </CardBody>
        </Card>
        <div className="xl:col-span-2">
          <PendingPayments />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MiniStat icon={TrendingUp} label="Receita do mês corrente" value={formatKz(f.monthRevenue)} sub={`de ${formatKz(f.monthExpected)} emitidos`} />
        <MiniStat icon={Banknote} label="A vencer (próximo mês)" value={formatKz(f.upcoming)} sub={`${f.upcomingCount} quotas`} />
        <MiniStat icon={CircleDollarSign} label="Taxa de cobrança" value={`${(f.collectionRate * 100).toFixed(1)}%`} sub="quotas aprovadas / vencidas" />
      </div>

      <RecentPayments />
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, sub }: { icon: typeof TrendingUp; label: string; value: string; sub: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-graphite-100 bg-white p-4 shadow-soft">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-900 text-gold-300">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs text-graphite-500">{label}</p>
        <p className="text-lg font-semibold text-navy-900 tabular-nums">{value}</p>
        <p className="text-[11px] text-graphite-400">{sub}</p>
      </div>
    </div>
  );
}
