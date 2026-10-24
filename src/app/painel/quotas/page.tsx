"use client";

import { CalendarPlus, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useDemoStore } from "@/store/demo-store";
import { useSession } from "@/hooks/use-session";
import { can } from "@/config/permissions";
import { CURRENT_PERIOD } from "@/hooks/use-finance";
import { formatDate, formatKz, formatQuarter, nextQuarter } from "@/lib/utils";
import { quotaDueDate } from "@/data/management";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GroupedBars } from "@/components/charts/charts";

export default function QuotasPage() {
  const session = useSession();
  const quotas = useDemoStore((s) => s.quotas);
  const apartments = useDemoStore((s) => s.apartments);
  const settings = useDemoStore((s) => s.settings);
  const updateSettings = useDemoStore((s) => s.updateSettings);
  const emitQuotas = useDemoStore((s) => s.emitQuotas);
  const canManage = can(session?.role, "quotas.manage");

  const [t2, setT2] = useState(String(settings.quotaByTypology.T2));
  const [duplex, setDuplex] = useState(String(settings.quotaByTypology.Duplex));
  const [partial, setPartial] = useState(settings.allowPartial);
  const [dueDay, setDueDay] = useState(String(settings.dueDay));
  const [emitting, setEmitting] = useState(false);

  const periods = useMemo(() => Array.from(new Set(quotas.map((q) => q.period))).sort(), [quotas]);
  const next = nextQuarter(periods.at(-1) ?? CURRENT_PERIOD);
  const activeApts = apartments.filter((a) => a.active);
  const eligible = activeApts.length;
  const nT2 = activeApts.filter((a) => a.typology === "T2").length;
  const nDuplex = activeApts.filter((a) => a.typology === "Duplex").length;
  const theoretical = nT2 * settings.quotaByTypology.T2 + nDuplex * settings.quotaByTypology.Duplex;

  const rows = useMemo(
    () =>
      periods
        .map((period) => {
          const list = quotas.filter((q) => q.period === period);
          const paid = list.filter((q) => q.status === "pago");
          return {
            period,
            due: list[0]?.dueDate ?? "",
            total: list.length,
            paid: paid.length,
            analysis: list.filter((q) => q.status === "em_analise").length,
            overdue: list.filter((q) => q.status === "em_atraso").length,
            emitted: list.reduce((a, q) => a + q.amount, 0),
            received: list.reduce((a, q) => a + q.paidAmount, 0),
            rate: list.length ? paid.length / list.length : 0,
          };
        })
        .reverse(),
    [quotas, periods],
  );

  const save = () => {
    const v2 = Number(t2.replace(/\D/g, ""));
    const vd = Number(duplex.replace(/\D/g, ""));
    const d = Number(dueDay);
    if (!v2 || !vd || v2 < 1000 || vd < 1000) return toast.error("Indique valores trimestrais válidos.");
    if (!d || d < 1 || d > 28) return toast.error("O dia limite deve estar entre 1 e 28.");
    updateSettings({ quotaByTypology: { T2: v2, Duplex: vd }, dueDay: d, allowPartial: partial });
    toast.success("Configuração actualizada", { description: "Aplica-se às próximas emissões de quotas. As quotas já emitidas mantêm o valor." });
  };

  return (
    <>
      <PageHeader
        eyebrow="Financeiro"
        title="Quotas trimestrais"
        description="Quota trimestral por tipologia (T2 e Duplex), quatro quotas por ano: Jan–Mar, Abr–Jun, Jul–Set e Out–Dez."
        actions={
          canManage && (
            <Button onClick={() => setEmitting(true)}>
              <CalendarPlus className="h-4 w-4" /> Emitir {formatQuarter(next, "short")}
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Configuração em vigor" description="Administração e Gestor Financeiro" />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="T2 (Kz/trimestre)">
                <Input inputMode="numeric" value={t2} onChange={(e) => setT2(e.target.value)} disabled={!canManage} />
              </Field>
              <Field label="Duplex (Kz/trimestre)">
                <Input inputMode="numeric" value={duplex} onChange={(e) => setDuplex(e.target.value)} disabled={!canManage} />
              </Field>
            </div>
            <Field label="Dia limite de pagamento" hint="No 1.º mês de cada trimestre (ex.: 15 de Outubro).">
              <Input type="number" min={1} max={28} value={dueDay} onChange={(e) => setDueDay(e.target.value)} disabled={!canManage} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-graphite-700">
              <input type="checkbox" className="h-4 w-4 accent-navy-900" checked={partial} onChange={(e) => setPartial(e.target.checked)} disabled={!canManage} /> Autorizar pagamentos parciais
            </label>
            <div className="rounded-xl bg-graphite-50 p-3 text-sm">
              <p className="text-xs text-graphite-500">Receita trimestral teórica (ocupação integral, sem descontos)</p>
              <p className="mt-1 text-xs text-graphite-600 tabular-nums">
                {nT2} × {formatKz(settings.quotaByTypology.T2)} + {nDuplex} × {formatKz(settings.quotaByTypology.Duplex)}
              </p>
              <p className="text-xl font-semibold text-navy-900 tabular-nums">{formatKz(theoretical)}</p>
              <p className="text-xs text-graphite-500">Anual: {formatKz(theoretical * 4)} — previsão de cobrança, não recebimentos.</p>
            </div>
            {canManage && (
              <Button onClick={save} className="w-full">
                <Save className="h-4 w-4" /> Guardar configuração
              </Button>
            )}
          </CardBody>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Emitido vs. recebido por trimestre" action={<DemoDataNote />} />
          <CardBody>
            <GroupedBars data={[...rows].reverse().map((r) => ({ label: formatQuarter(r.period, "short"), emitido: r.emitted, recebido: r.received }))} series={[{ key: "emitido", label: "Emitido" }, { key: "recebido", label: "Recebido" }]} />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Quotas por trimestre" description="Clique em Pagamentos para validar comprovativos e filtrar por bloco ou apartamento." />
        <DataTable
          rows={rows}
          rowKey={(r) => r.period}
          columns={[
            {
              key: "period",
              header: "Trimestre",
              primary: true,
              cell: (r) => (
                <span className="flex flex-wrap items-center gap-2">
                  <span>
                    <span className="block font-semibold text-navy-900">{formatQuarter(r.period)}</span>
                    <span className="block text-xs text-graphite-500">{formatQuarter(r.period, "months")}</span>
                  </span>
                  {r.period === CURRENT_PERIOD && <Badge tone="gold">Corrente</Badge>}
                </span>
              ),
            },
            { key: "due", header: "Data limite", cell: (r) => (r.due ? formatDate(r.due) : "—") },
            { key: "total", header: "Emitidas", align: "center", cell: (r) => r.total },
            { key: "paid", header: "Pagas", align: "center", cell: (r) => r.paid },
            { key: "analysis", header: "Em validação", align: "center", cell: (r) => r.analysis, hideOnMobile: true },
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

      <ConfirmDialog
        open={emitting}
        onClose={() => setEmitting(false)}
        tone="primary"
        title={`Emitir quotas do ${formatQuarter(next)}?`}
        description={`Serão criadas até ${eligible} quotas (${nT2} T2 × ${formatKz(settings.quotaByTypology.T2)} + ${nDuplex} Duplex × ${formatKz(settings.quotaByTypology.Duplex)}), uma por fracção, com data limite ${formatDate(quotaDueDate(next, settings.dueDay))}. Quotas já emitidas não são duplicadas.`}
        confirmLabel="Emitir quotas"
        onConfirm={() => {
          const n = emitQuotas(next);
          toast.success(`${n} quotas emitidas para o ${formatQuarter(next)}.`);
        }}
      />
    </>
  );
}
