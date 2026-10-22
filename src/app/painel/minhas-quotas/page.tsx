"use client";

import { CheckCircle2, FileText, FlaskConical, Wallet, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Payment, Quota } from "@/types";
import { useDemoStore, formatApt } from "@/store/demo-store";
import { useCurrentResident } from "@/hooks/use-session";
import { withDemoRole } from "@/store/auth-store";
import { cn, formatDate, formatKz, formatQuarter } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { PayQuotaModal } from "@/components/app/widgets/pay-quota-modal";
import { ProofPreview } from "@/components/app/widgets/review-payment-modal";

export default function MinhasQuotasPage() {
  const { resident, apartment } = useCurrentResident();
  const quotas = useDemoStore((s) => s.quotas);
  const payments = useDemoStore((s) => s.payments);
  const quarterly = useDemoStore((s) => s.settings.quarterlyQuota);
  const review = useDemoStore((s) => s.reviewPayment);
  const [tab, setTab] = useState<"abertas" | "todas" | "pagas">("abertas");
  const [paying, setPaying] = useState<Quota | null>(null);
  const [proof, setProof] = useState<Payment | null>(null);

  const mine = useMemo(() => quotas.filter((q) => q.apartmentId === apartment?.id).sort((a, b) => b.period.localeCompare(a.period)), [quotas, apartment]);
  const list = mine.filter((q) => (tab === "todas" ? true : tab === "pagas" ? q.status === "pago" : q.status !== "pago"));
  const debt = mine.filter((q) => q.status === "pendente" || q.status === "em_atraso").reduce((a, q) => a + q.amount, 0);
  const paymentOf = (q: Quota) => payments.find((p) => p.id === q.paymentId);

  // Simulação do Financeiro/Administrador apenas para a demonstração do fluxo.
  const simulate = (q: Quota, d: "aprovado" | "rejeitado") => {
    if (!q.paymentId) return;
    const id = q.paymentId;
    withDemoRole("administrador", () => review(id, d, "Administração (simulação)", d === "rejeitado" ? "Comprovativo rejeitado em simulação." : undefined));
    toast.success(d === "aprovado" ? "Pagamento validado (simulação da Administração)" : "Comprovativo rejeitado (simulação)");
  };

  return (
    <>
      <PageHeader
        eyebrow="Minha área"
        title="Minhas quotas"
        description={`${apartment ? formatApt(apartment) : "—"} · quota do condomínio paga por trimestre`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-gradient-to-br from-navy-900 to-navy-800 p-5 text-white shadow-lift">
          <p className="text-xs text-navy-200">Saldo em dívida</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{formatKz(debt)}</p>
        </div>
        <div className="rounded-2xl border border-graphite-100 bg-white p-5 shadow-soft">
          <p className="text-xs text-graphite-500">Quota trimestral</p>
          <p className="mt-2 text-3xl font-semibold text-navy-900 tabular-nums">{formatKz(quarterly)}</p>
          <p className="text-xs text-graphite-400">por trimestre (não é mensalidade)</p>
        </div>
        <div className="rounded-2xl border border-graphite-100 bg-white p-5 shadow-soft">
          <p className="text-xs text-graphite-500">Trimestres pagos · em análise</p>
          <p className="mt-2 text-3xl font-semibold text-navy-900">
            {mine.filter((q) => q.status === "pago").length} <span className="text-lg text-graphite-400">· {mine.filter((q) => q.status === "em_analise").length}</span>
          </p>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Histórico trimestral"
          action={
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "abertas", label: "Em aberto", count: mine.filter((q) => q.status !== "pago").length },
                { id: "pagas", label: "Pagas" },
                { id: "todas", label: "Todas" },
              ]}
            />
          }
        />
        {list.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Nada por pagar" description="Todas as quotas trimestrais estão regularizadas." />
        ) : (
          <>
            <div className="hidden grid-cols-[1.6fr_0.6fr_1fr_1fr_1.1fr_1fr_auto] gap-3 border-b border-graphite-100 bg-graphite-50/70 px-5 py-3 text-[11px] font-semibold tracking-wider text-graphite-500 uppercase lg:grid">
              <span>Trimestre de referência</span>
              <span>Ano</span>
              <span className="text-right">Valor</span>
              <span>Estado</span>
              <span>Data do pagamento</span>
              <span>Comprovativo</span>
              <span />
            </div>
            <ul className="divide-y divide-graphite-100">
              {list.map((q) => {
                const payable = q.status === "pendente" || q.status === "em_atraso";
                const pay = paymentOf(q);
                const lastRejected = payments.find((p) => p.quotaId === q.id && p.status === "rejeitado");
                return (
                  <li key={q.id} className="grid grid-cols-2 gap-3 px-5 py-4 lg:grid-cols-[1.6fr_0.6fr_1fr_1fr_1.1fr_1fr_auto] lg:items-center">
                    <div className="col-span-2 flex items-center gap-3 lg:col-span-1">
                      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold", q.status === "pago" ? "bg-emerald-50 text-emerald-700" : "bg-navy-50 text-navy-800")}>
                        T{q.quarter}
                      </span>
                      <div>
                        <p className="font-medium text-navy-900">{q.quarter}.º Trimestre</p>
                        <p className="text-xs text-graphite-500">
                          {formatQuarter(q.period, "months").replace(` ${q.year}`, "")} · limite {formatDate(q.dueDate)}
                        </p>
                        {lastRejected?.note && q.status !== "pago" && q.status !== "em_analise" && <p className="text-xs text-red-600">Comprovativo rejeitado: {lastRejected.note}</p>}
                      </div>
                    </div>
                    <Cell label="Ano">{q.year}</Cell>
                    <Cell label="Valor" className="lg:text-right">
                      <span className="font-semibold text-navy-900 tabular-nums">{formatKz(q.amount)}</span>
                    </Cell>
                    <Cell label="Estado">
                      <StatusBadge status={q.status} />
                    </Cell>
                    <Cell label="Data do pagamento">{pay && pay.status !== "rejeitado" ? formatDate(pay.paidAt) : "—"}</Cell>
                    <Cell label="Comprovativo">
                      {pay?.proof ? (
                        <button onClick={() => setProof(pay)} className="inline-flex items-center gap-1 text-xs font-medium text-navy-700 hover:text-navy-900">
                          <FileText className="h-3.5 w-3.5" /> Ver
                        </button>
                      ) : (
                        "—"
                      )}
                    </Cell>
                    <div className="col-span-2 flex flex-wrap items-center gap-2 lg:col-span-1 lg:justify-end">
                      {payable && (
                        <Button size="sm" variant="gold" onClick={() => setPaying(q)}>
                          <Wallet className="h-3.5 w-3.5" /> {lastRejected ? "Reenviar" : "Pagar"}
                        </Button>
                      )}
                      {q.status === "em_analise" && (
                        <span className="flex items-center gap-1 rounded-xl border border-dashed border-gold-300 bg-gold-50/60 p-1">
                          <FlaskConical className="ml-1 h-3.5 w-3.5 text-gold-700" />
                          <button onClick={() => simulate(q, "aprovado")} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-white" title="Simular validação pela Administração">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Simular validação
                          </button>
                          <button onClick={() => simulate(q, "rejeitado")} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-white">
                            <XCircle className="h-3.5 w-3.5" /> Rejeitar
                          </button>
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
      <PayQuotaModal quota={paying} residentId={resident?.id} onClose={() => setPaying(null)} />
      <Modal open={!!proof} onClose={() => setProof(null)} size="lg" title={proof?.proof?.name ?? ""} description={proof ? `Referência ${proof.reference || "não indicada"}` : ""}>
        {proof && <ProofPreview payment={proof} />}
      </Modal>
    </>
  );
}

function Cell({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("text-sm text-graphite-700", className)}>
      <span className="block text-[10px] tracking-wider text-graphite-400 uppercase lg:hidden">{label}</span>
      {children}
    </div>
  );
}
