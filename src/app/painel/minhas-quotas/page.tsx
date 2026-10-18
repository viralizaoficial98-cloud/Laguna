"use client";

import { CheckCircle2, FlaskConical, Wallet, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Quota } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { useCurrentResident } from "@/hooks/use-session";
import { CURRENT_PERIOD } from "@/hooks/use-finance";
import { cn, formatDate, formatKz, formatPeriod } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { PayQuotaModal } from "@/components/app/widgets/pay-quota-modal";

export default function MinhasQuotasPage() {
  const { resident, apartment } = useCurrentResident();
  const quotas = useDemoStore((s) => s.quotas);
  const payments = useDemoStore((s) => s.payments);
  const review = useDemoStore((s) => s.reviewPayment);
  const [tab, setTab] = useState<"abertas" | "todas" | "pagas">("abertas");
  const [paying, setPaying] = useState<Quota | null>(null);

  const mine = useMemo(() => quotas.filter((q) => q.apartmentId === apartment?.id).sort((a, b) => b.period.localeCompare(a.period)), [quotas, apartment]);
  const list = mine.filter((q) => (tab === "todas" ? true : tab === "pagas" ? q.status === "aprovado" : q.status !== "aprovado"));
  const openAmount = mine.filter((q) => ["pendente", "em_atraso", "rejeitado"].includes(q.status)).reduce((a, q) => a + q.amount, 0);

  const simulate = (q: Quota, d: "aprovado" | "rejeitado") => {
    if (!q.paymentId) return;
    review(q.paymentId, d, "Financeiro (simulação)", d === "rejeitado" ? "Comprovativo rejeitado em simulação." : undefined);
    toast.success(d === "aprovado" ? "Pagamento aprovado (simulação do Financeiro)" : "Pagamento rejeitado (simulação)");
  };

  return (
    <>
      <PageHeader eyebrow="Minha área" title="Minhas quotas" description={`Apartamento ${apartment ? `${apartment.block}-${apartment.number}` : "—"} · quota mensal ${apartment ? formatKz(apartment.monthlyQuota) : "—"}`} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-gradient-to-br from-navy-900 to-navy-800 p-5 text-white shadow-lift">
          <p className="text-xs text-navy-200">Total em aberto</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{formatKz(openAmount)}</p>
        </div>
        <div className="rounded-2xl border border-graphite-100 bg-white p-5 shadow-soft">
          <p className="text-xs text-graphite-500">Quotas pagas</p>
          <p className="mt-2 text-3xl font-semibold text-navy-900">{mine.filter((q) => q.status === "aprovado").length}</p>
        </div>
        <div className="rounded-2xl border border-graphite-100 bg-white p-5 shadow-soft">
          <p className="text-xs text-graphite-500">Em análise</p>
          <p className="mt-2 text-3xl font-semibold text-navy-900">{mine.filter((q) => q.status === "em_analise").length}</p>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Quotas"
          action={
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "abertas", label: "Em aberto", count: mine.filter((q) => q.status !== "aprovado").length },
                { id: "pagas", label: "Pagas" },
                { id: "todas", label: "Todas" },
              ]}
            />
          }
        />
        {list.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Nada por pagar" description="Todas as suas quotas estão regularizadas." />
        ) : (
          <ul className="divide-y divide-graphite-100">
            {list.map((q) => {
              const payable = ["pendente", "em_atraso", "rejeitado"].includes(q.status);
              const pay = payments.find((p) => p.id === q.paymentId);
              return (
                <li key={q.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <span className={cn("flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl text-center", q.status === "aprovado" ? "bg-emerald-50 text-emerald-700" : "bg-navy-50 text-navy-800")}>
                      <span className="text-[10px] leading-none font-semibold uppercase">{formatPeriod(q.period).split(" ")[0]}</span>
                      <span className="text-xs leading-tight">{q.period.slice(0, 4)}</span>
                    </span>
                    <div>
                      <p className="font-medium text-navy-900">
                        {q.description} — {formatPeriod(q.period, true)}
                      </p>
                      <p className="text-xs text-graphite-500">
                        Vence a {formatDate(q.dueDate)}
                        {q.period > CURRENT_PERIOD && " · a vencer"}
                        {pay?.status === "rejeitado" && pay.note && <span className="text-red-600"> · {pay.note}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <span className="font-semibold text-navy-900 tabular-nums">{formatKz(q.amount)}</span>
                    <StatusBadge status={q.status} />
                    {payable && (
                      <Button size="sm" variant="gold" onClick={() => setPaying(q)}>
                        <Wallet className="h-3.5 w-3.5" /> {q.status === "rejeitado" ? "Reenviar" : "Pagar"}
                      </Button>
                    )}
                    {q.status === "em_analise" && (
                      <span className="flex items-center gap-1 rounded-xl border border-dashed border-gold-300 bg-gold-50/60 p-1">
                        <FlaskConical className="ml-1 h-3.5 w-3.5 text-gold-700" />
                        <button onClick={() => simulate(q, "aprovado")} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-white" title="Simular aprovação pelo Financeiro">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Simular aprovação
                        </button>
                        <button onClick={() => simulate(q, "rejeitado")} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-white" title="Simular rejeição">
                          <XCircle className="h-3.5 w-3.5" /> Rejeitar
                        </button>
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <PayQuotaModal quota={paying} residentId={resident?.id} onClose={() => setPaying(null)} />
    </>
  );
}
