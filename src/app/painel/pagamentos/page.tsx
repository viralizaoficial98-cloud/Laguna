"use client";

import { BellRing, Check, Download, FileSearch, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Payment, Quota, QuotaStatus } from "@/types";
import { useDemoStore, aptLabel } from "@/store/demo-store";
import { useSession } from "@/hooks/use-session";
import { useFinance } from "@/hooks/use-finance";
import { QUOTA_PERIODS } from "@/data/management";
import { downloadCsv, formatDate, formatKz, formatPeriod, includesText } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/field";
import { StatusBadge, statusLabel } from "@/components/ui/status-badge";
import { Toolbar } from "@/components/ui/toolbar";
import { Tabs } from "@/components/ui/tabs";
import { StatCard } from "@/components/ui/stat-card";
import { IconBtn } from "@/components/ui/icon-button";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { METHOD_LABELS, ReviewPaymentModal } from "@/components/app/widgets/review-payment-modal";
import { AlertTriangle, CircleDollarSign, Clock, Hourglass } from "lucide-react";

type TabId = "todos" | QuotaStatus | "historico";

export default function PagamentosPage() {
  const session = useSession();
  const quotas = useDemoStore((s) => s.quotas);
  const payments = useDemoStore((s) => s.payments);
  const apartments = useDemoStore((s) => s.apartments);
  const residents = useDemoStore((s) => s.residents);
  const review = useDemoStore((s) => s.reviewPayment);
  const f = useFinance();

  const [tab, setTab] = useState<TabId>("em_analise");
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState("");
  const [block, setBlock] = useState("");
  const [selected, setSelected] = useState<Payment | null>(null);

  const resOf = (aptId: string) => residents.find((r) => r.apartmentId === aptId)?.name ?? "—";
  const blocks = useMemo(() => Array.from(new Set(apartments.map((a) => a.block))).sort(), [apartments]);

  const quotaRows = useMemo(
    () =>
      quotas
        .filter((x) => (tab === "todos" || x.status === tab) && (!period || x.period === period) && (!block || x.apartmentId.startsWith(`apt_${block}`)))
        .filter((x) => includesText([aptLabel(apartments, x.apartmentId), resOf(x.apartmentId)], q))
        .sort((a, b) => b.period.localeCompare(a.period) || a.apartmentId.localeCompare(b.apartmentId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quotas, tab, period, block, q, apartments, residents],
  );

  const history = useMemo(
    () =>
      payments
        .filter((p) => (!block || p.apartmentId.startsWith(`apt_${block}`)) && (!period || quotas.find((x) => x.id === p.quotaId)?.period === period))
        .filter((p) => includesText([aptLabel(apartments, p.apartmentId), p.reference, resOf(p.apartmentId)], q))
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments, block, period, q, apartments, residents, quotas],
  );

  const count = (s: QuotaStatus) => quotas.filter((x) => x.status === s).length;
  const paymentOf = (quota: Quota) => payments.find((p) => p.id === quota.paymentId);

  const quick = (quota: Quota, d: "aprovado" | "rejeitado") => {
    const p = paymentOf(quota);
    if (!p) return;
    if (d === "rejeitado") {
      setSelected(p);
      return;
    }
    review(p.id, d, session?.name ?? "Financeiro");
    toast.success(`Pagamento de ${aptLabel(apartments, quota.apartmentId)} aprovado`);
  };

  const exportCsv = () => {
    if (tab === "historico") {
      downloadCsv("laguna-historico-transaccoes-demo.csv", [
        ["Apartamento", "Referência", "Método", "Data", "Valor (Kz)", "Estado"],
        ...history.map((p) => [aptLabel(apartments, p.apartmentId), p.reference, METHOD_LABELS[p.method], formatDate(p.submittedAt), p.amount, statusLabel(p.status)]),
      ]);
    } else {
      downloadCsv("laguna-pagamentos-demo.csv", [
        ["Apartamento", "Morador", "Período", "Vencimento", "Valor (Kz)", "Estado"],
        ...quotaRows.map((x) => [aptLabel(apartments, x.apartmentId), resOf(x.apartmentId), formatPeriod(x.period), formatDate(x.dueDate), x.amount, statusLabel(x.status)]),
      ]);
    }
    toast.success("Ficheiro CSV exportado (dados de demonstração).");
  };

  return (
    <>
      <PageHeader
        eyebrow="Financeiro"
        title="Pagamentos"
        description="Aprovação de comprovativos e acompanhamento do estado das quotas."
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} highlight label="Total recebido" value={formatKz(f.received)} icon={CircleDollarSign} />
        <StatCard index={1} label="Em análise" value={f.analysisCount} icon={Hourglass} tone="gold" hint={formatKz(f.analysis)} />
        <StatCard index={2} label="Pendente" value={formatKz(f.pending)} icon={Clock} tone="info" hint={`${f.pendingCount} quotas`} />
        <StatCard index={3} label="Em atraso" value={formatKz(f.overdue)} icon={AlertTriangle} tone="warning" hint={`${f.overdueCount} quotas`} />
      </div>

      <Card>
        <Toolbar>
          <Tabs<TabId>
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "em_analise", label: "Em análise", count: count("em_analise") },
              { id: "pendente", label: "Pendentes", count: count("pendente") },
              { id: "em_atraso", label: "Em atraso", count: count("em_atraso") },
              { id: "aprovado", label: "Aprovados", count: count("aprovado") },
              { id: "rejeitado", label: "Rejeitados", count: count("rejeitado") },
              { id: "todos", label: "Todos" },
              { id: "historico", label: "Histórico de transacções" },
            ]}
          />
        </Toolbar>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Apartamento, morador ou referência…" className="sm:w-72" />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="sm:w-40" aria-label="Período">
              <option value="">Todos os períodos</option>
              {QUOTA_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {formatPeriod(p, true)}
                </option>
              ))}
            </Select>
            <Select value={block} onChange={(e) => setBlock(e.target.value)} className="sm:w-36" aria-label="Bloco">
              <option value="">Todos os blocos</option>
              {blocks.map((b) => (
                <option key={b} value={b}>
                  Bloco {b}
                </option>
              ))}
            </Select>
          </div>
          <DemoDataNote className="sm:ml-auto" />
        </Toolbar>

        {tab === "historico" ? (
          <DataTable
            rows={history}
            rowKey={(r) => r.id}
            onRowClick={setSelected}
            columns={[
              { key: "apt", header: "Apartamento", primary: true, cell: (p) => <span className="font-semibold text-navy-900">{aptLabel(apartments, p.apartmentId)}</span> },
              { key: "ref", header: "Referência", cell: (p) => <span className="font-mono text-xs">{p.reference}</span> },
              { key: "method", header: "Método", cell: (p) => METHOD_LABELS[p.method], hideOnMobile: true },
              { key: "date", header: "Submetido", cell: (p) => formatDate(p.submittedAt) },
              { key: "amount", header: "Valor", align: "right", cell: (p) => <span className="font-medium tabular-nums">{formatKz(p.amount)}</span> },
              { key: "rev", header: "Revisto por", cell: (p) => p.reviewedBy ?? "—", hideOnMobile: true },
              { key: "status", header: "Estado", cell: (p) => <StatusBadge status={p.status} /> },
            ]}
          />
        ) : (
          <DataTable
            rows={quotaRows}
            rowKey={(r) => r.id}
            onRowClick={(x) => {
              const p = paymentOf(x);
              if (p) setSelected(p);
            }}
            emptyTitle={tab === "em_analise" ? "Sem comprovativos em análise" : "Sem resultados"}
            columns={[
              { key: "apt", header: "Apartamento", primary: true, cell: (x) => <span className="font-semibold text-navy-900">{aptLabel(apartments, x.apartmentId)}</span> },
              { key: "res", header: "Morador", cell: (x) => resOf(x.apartmentId) },
              { key: "period", header: "Período", cell: (x) => formatPeriod(x.period) },
              { key: "due", header: "Vencimento", cell: (x) => formatDate(x.dueDate), hideOnMobile: true },
              { key: "amount", header: "Valor", align: "right", cell: (x) => <span className="font-medium tabular-nums">{formatKz(x.amount)}</span> },
              { key: "status", header: "Estado", cell: (x) => <StatusBadge status={x.status} /> },
              {
                key: "actions",
                header: "",
                align: "right",
                cell: (x) => (
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {x.status === "em_analise" && (
                      <>
                        <IconBtn label="Aprovar" onClick={() => quick(x, "aprovado")}>
                          <Check className="h-4 w-4 text-emerald-700" />
                        </IconBtn>
                        <IconBtn label="Rejeitar" danger onClick={() => quick(x, "rejeitado")}>
                          <X className="h-4 w-4" />
                        </IconBtn>
                      </>
                    )}
                    {paymentOf(x) && (
                      <IconBtn label="Ver comprovativo" onClick={() => setSelected(paymentOf(x)!)}>
                        <FileSearch className="h-4 w-4" />
                      </IconBtn>
                    )}
                    {(x.status === "pendente" || x.status === "em_atraso") && (
                      <IconBtn label="Enviar lembrete" onClick={() => toast.success(`Lembrete enviado a ${resOf(x.apartmentId)} (simulação)`)}>
                        <BellRing className="h-4 w-4" />
                      </IconBtn>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>
      <ReviewPaymentModal payment={selected} onClose={() => setSelected(null)} />
    </>
  );
}
