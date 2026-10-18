"use client";

import { useMemo } from "react";
import { useDemoStore } from "@/store/demo-store";
import { QUOTA_BY_TYPOLOGY, QUOTA_PERIODS } from "@/data/management";
import { formatDate, formatKz, formatPeriod } from "@/lib/utils";
import { CURRENT_PERIOD } from "@/hooks/use-finance";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { GroupedBars } from "@/components/charts/charts";

export default function QuotasPage() {
  const quotas = useDemoStore((s) => s.quotas);
  const apartments = useDemoStore((s) => s.apartments);

  const rows = useMemo(
    () =>
      QUOTA_PERIODS.map((period) => {
        const list = quotas.filter((q) => q.period === period);
        const paid = list.filter((q) => q.status === "aprovado");
        const emitted = list.reduce((a, q) => a + q.amount, 0);
        const received = paid.reduce((a, q) => a + q.amount, 0);
        return {
          period,
          due: `${period}-25`,
          total: list.length,
          paid: paid.length,
          analysis: list.filter((q) => q.status === "em_analise").length,
          overdue: list.filter((q) => q.status === "em_atraso").length,
          emitted,
          received,
          rate: list.length ? paid.length / list.length : 0,
        };
      }).reverse(),
    [quotas],
  );

  const byTypology = (Object.keys(QUOTA_BY_TYPOLOGY) as (keyof typeof QUOTA_BY_TYPOLOGY)[]).map((t) => ({
    typology: t,
    value: QUOTA_BY_TYPOLOGY[t],
    count: apartments.filter((a) => a.typology === t).length,
  }));

  return (
    <>
      <PageHeader eyebrow="Financeiro" title="Quotas" description="Emissão mensal de quotas, valores por tipologia e taxa de cobrança." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Emissão vs. cobrança por período" action={<DemoDataNote />} />
          <CardBody>
            <GroupedBars data={[...rows].reverse().map((r) => ({ label: formatPeriod(r.period).split(" ")[0], emitido: r.emitted, recebido: r.received }))} series={[{ key: "emitido", label: "Emitido" }, { key: "recebido", label: "Recebido" }]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Valor da quota por tipologia" description="Valores de demonstração (Kz/mês)" />
          <ul className="divide-y divide-graphite-100">
            {byTypology.map((t) => (
              <li key={t.typology} className="flex items-center justify-between px-5 py-3.5">
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-900 text-xs font-bold text-gold-300">{t.typology}</span>
                  <span className="text-sm text-graphite-600">{t.count} apartamentos</span>
                </span>
                <span className="font-semibold text-navy-900 tabular-nums">{formatKz(t.value)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader title="Quotas por período" />
        <DataTable
          rows={rows}
          rowKey={(r) => r.period}
          columns={[
            {
              key: "period",
              header: "Período",
              primary: true,
              cell: (r) => (
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-navy-900">{formatPeriod(r.period, true)}</span>
                  {r.period === CURRENT_PERIOD && <Badge tone="gold">Corrente</Badge>}
                  {r.period > CURRENT_PERIOD && <Badge tone="info">A vencer</Badge>}
                </span>
              ),
            },
            { key: "due", header: "Vencimento", cell: (r) => formatDate(r.due) },
            { key: "total", header: "Emitidas", align: "center", cell: (r) => r.total },
            { key: "paid", header: "Pagas", align: "center", cell: (r) => r.paid },
            { key: "analysis", header: "Em análise", align: "center", cell: (r) => r.analysis, hideOnMobile: true },
            { key: "overdue", header: "Em atraso", align: "center", cell: (r) => r.overdue, hideOnMobile: true },
            { key: "emitted", header: "Emitido", align: "right", cell: (r) => <span className="tabular-nums">{formatKz(r.emitted)}</span> },
            { key: "received", header: "Recebido", align: "right", cell: (r) => <span className="font-medium tabular-nums">{formatKz(r.received)}</span> },
            {
              key: "rate",
              header: "Cobrança",
              cell: (r) => (
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-20 overflow-hidden rounded-full bg-graphite-100">
                    <span className="block h-full rounded-full bg-navy-500" style={{ width: `${r.rate * 100}%` }} />
                  </span>
                  <span className="text-xs tabular-nums">{Math.round(r.rate * 100)}%</span>
                </span>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
