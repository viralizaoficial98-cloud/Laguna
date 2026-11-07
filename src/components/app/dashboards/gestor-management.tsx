"use client";

import { AlertTriangle, Building2, CircleDollarSign, Clock, FileSignature, Gauge, Hourglass, Landmark, PenLine, Receipt, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useDemoStore } from "@/store/demo-store";
import { useFinance } from "@/hooks/use-finance";
import { useApi } from "@/hooks/use-api";
import { formatKz, todayISO } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { GroupedBars, HBars, MultiLine } from "@/components/charts/charts";

interface Summary {
  available: boolean;
  totals?: { revenue: { annual: number; executed: number }; expense: { annual: number; executed: number }; balanceExecuted: number };
  expenseByLine?: { name: string; annual: number; executed: number; isGroup: boolean; depth: number }[];
  over?: { name: string; annual: number; executed: number }[];
  revenueByQuarter?: { label: string; receitas: number; despesas: number; orcamento: number }[];
}

/** Indicadores de gestão financeira, orçamental e documental para o dashboard do Gestor Operacional. */
export function GestorManagement() {
  const year = new Date().getFullYear();
  const f = useFinance({ year });
  const apartments = useDemoStore((s) => s.apartments);
  const residents = useDemoStore((s) => s.residents);
  const expenses = useDemoStore((s) => s.expenses);
  const { data: budget } = useApi<Summary>(`/api/budget/summary?year=${year}`);
  const { data: decl } = useApi<{ declarations: { status: string }[] }>("/api/declarations");
  const month = todayISO().slice(0, 7);
  const monthExp = useMemo(() => expenses.filter((e) => e.status !== "anulada" && (e.paymentDate ?? e.date).startsWith(month)).reduce((a, e) => a + e.amount, 0), [expenses, month]);
  const yearExp = useMemo(() => expenses.filter((e) => e.status !== "anulada" && (e.paymentDate ?? e.date).startsWith(String(year))).reduce((a, e) => a + e.amount, 0), [expenses, year]);
  const requests = (decl?.declarations ?? []).filter((d) => d.status === "solicitada" || d.status === "em_analise").length;
  const toSign = (decl?.declarations ?? []).filter((d) => d.status === "aguardando_assinatura").length;
  const t = budget?.totals;
  const execPct = t && t.expense.annual ? (t.expense.executed / t.expense.annual) * 100 : null;

  return (
    <>
      <h2 className="mt-2 mb-3 text-xs font-semibold tracking-[0.2em] text-graphite-400 uppercase">Gestão financeira · {year}</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="gestor-finance-kpis">
        <StatCard index={0} label="Receitas previstas" value={formatKz(f.expected)} icon={Receipt} hint="quotas emitidas no ano" />
        <StatCard index={1} highlight label="Receitas recebidas" value={formatKz(f.received)} icon={CircleDollarSign} hint={`${(f.collectionRate * 100).toFixed(1)}% de cobrança`} />
        <StatCard index={2} label="Quotas por receber" value={formatKz(f.pending)} icon={Clock} tone="info" hint={`${f.pendingCount} no prazo`} />
        <StatCard index={3} label="Dívida acumulada" value={formatKz(f.overdue)} icon={AlertTriangle} tone="warning" hint={`${f.arrearsCount} fracções em atraso`} />
        <StatCard index={4} label="Pendentes de validação" value={f.analysisCount} icon={Hourglass} tone="gold" hint={formatKz(f.analysis)} />
        <StatCard index={5} label="Despesas do mês" value={formatKz(monthExp)} icon={Wallet} tone="danger" hint={`ano: ${formatKz(yearExp)}`} />
        <StatCard index={6} label="Orçamento disponível" value={t ? formatKz(t.expense.annual - t.expense.executed) : "—"} icon={Landmark} tone="success" hint={execPct !== null ? `${execPct.toFixed(1)}% executado` : "orçamento por importar"} />
        <StatCard index={7} label="Saldo financeiro" value={formatKz(f.result)} icon={Gauge} tone={f.result >= 0 ? "success" : "danger"} hint="recebido + reservas − despesas" />
        <StatCard index={8} label="Moradores registados" value={residents.filter((r) => r.status === "activo").length} icon={Users} tone="navy" />
        <StatCard index={9} label="Fracções ocupadas" value={`${apartments.filter((a) => a.active && a.status === "ocupado").length}/${apartments.filter((a) => a.active).length}`} icon={Building2} tone="navy" />
        <StatCard index={10} label="Pedidos de declaração" value={requests} icon={FileSignature} tone="info" hint={<Link href="/painel/declaracoes" className="underline">abrir</Link>} />
        <StatCard index={11} label="Por assinar" value={toSign} icon={PenLine} tone="gold" hint={<Link href="/painel/declaracoes/pendentes" className="underline">documentos pendentes</Link>} />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Receitas e despesas por trimestre" description={budget?.available ? "Execução (ficheiro de origem + movimentos do sistema)" : "Quotas recebidas vs despesas registadas"} />
          <CardBody>
            {budget?.available && budget.revenueByQuarter ? (
              <GroupedBars data={budget.revenueByQuarter} series={[{ key: "orcamento", label: "Receita orçada" }, { key: "receitas", label: "Receitas" }, { key: "despesas", label: "Despesas" }]} />
            ) : (
              <GroupedBars data={f.quarterly} series={[{ key: "recebida", label: "Receitas" }, { key: "despesas", label: "Despesas" }]} />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Evolução da cobrança" description="Taxa de cobrança das quotas por trimestre" />
          <CardBody>
            <MultiLine data={f.quarterly} series={[{ key: "taxa", label: "Taxa de cobrança (%)" }]} currency={false} percent />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Execução por rubrica" description="Despesas executadas por grupo do orçamento" action={<Link href="/painel/orcamento" className="text-xs font-medium text-navy-700">Orçamento</Link>} />
          <CardBody>
            {budget?.expenseByLine?.length ? <HBars currency data={budget.expenseByLine.filter((l) => l.depth === 1).map((l) => ({ label: l.name.slice(0, 26), value: Math.round(l.executed) }))} /> : <p className="text-sm text-graphite-500">Importe o orçamento em Importação de dados.</p>}
            {(budget?.over ?? []).length > 0 && <p className="mt-3 text-xs text-red-700">Acima do orçamento: {budget!.over!.map((o) => o.name).join(", ")}</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Situação financeira por trimestre" description="Prevista, recebida e em atraso" />
          <CardBody>
            <GroupedBars data={f.quarterly} series={[{ key: "prevista", label: "Prevista" }, { key: "recebida", label: "Recebida" }, { key: "emAtraso", label: "Em atraso" }]} />
          </CardBody>
        </Card>
      </div>
      <h2 className="mt-8 mb-3 text-xs font-semibold tracking-[0.2em] text-graphite-400 uppercase">Operações</h2>
    </>
  );
}
