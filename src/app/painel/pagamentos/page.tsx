"use client";

import { AlertTriangle, BellRing, Check, CircleDollarSign, Clock, Download, FileSearch, Hourglass, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Payment, Quota, QuotaStatus } from "@/types";
import { useDemoStore, aptLabel } from "@/store/demo-store";
import { useSession } from "@/hooks/use-session";
import { can } from "@/config/permissions";
import { roleLabels } from "@/data/users";
import { useFinance } from "@/hooks/use-finance";
import { BLOCKS } from "@/data/management";
import { downloadCsv, formatDate, formatKz, formatQuarter, includesText } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Input, Select } from "@/components/ui/field";
import { StatusBadge, statusLabel } from "@/components/ui/status-badge";
import { Toolbar } from "@/components/ui/toolbar";
import { Tabs } from "@/components/ui/tabs";
import { StatCard } from "@/components/ui/stat-card";
import { IconBtn } from "@/components/ui/icon-button";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { METHOD_LABELS, ReviewPaymentModal } from "@/components/app/widgets/review-payment-modal";
import { RegisterPaymentModal } from "@/components/app/widgets/register-payment-modal";

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
  const [year, setYear] = useState("");
  const [quarter, setQuarter] = useState("");
  const [block, setBlock] = useState("");
  const [apt, setApt] = useState("");
  const [selected, setSelected] = useState<Payment | null>(null);
  const [registering, setRegistering] = useState(false);
  const canRegister = can(session?.role, "payments.register");

  const years = useMemo(() => Array.from(new Set(quotas.map((x) => x.year))).sort().reverse(), [quotas]);
  const resOf = (aptId: string) => residents.find((r) => r.apartmentId === aptId)?.name ?? "—";
  const aptOf = (id: string) => apartments.find((a) => a.id === id);
  const matchesFilters = (aptId: string, quota?: Quota) => {
    const a = aptOf(aptId);
    return (
      (!block || a?.block === block) &&
      (!apt || (a?.number ?? "").includes(apt.trim())) &&
      (!year || String(quota?.year) === year) &&
      (!quarter || String(quota?.quarter) === quarter)
    );
  };

  const quotaRows = useMemo(
    () =>
      quotas
        .filter((x) => (tab === "todos" || x.status === tab) && matchesFilters(x.apartmentId, x))
        .filter((x) => includesText([aptLabel(apartments, x.apartmentId), resOf(x.apartmentId)], q))
        .sort((a, b) => b.period.localeCompare(a.period) || a.apartmentId.localeCompare(b.apartmentId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quotas, tab, year, quarter, block, apt, q, apartments, residents],
  );

  const history = useMemo(
    () =>
      payments
        .filter((p) => matchesFilters(p.apartmentId, quotas.find((x) => x.id === p.quotaId)))
        .filter((p) => includesText([aptLabel(apartments, p.apartmentId), p.reference, resOf(p.apartmentId)], q))
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments, year, quarter, block, apt, q, apartments, residents, quotas],
  );

  const count = (s: QuotaStatus) => quotas.filter((x) => x.status === s).length;
  const paymentOf = (quota: Quota) => payments.find((p) => p.id === quota.paymentId);
  const periodOf = (p: Payment) => quotas.find((x) => x.id === p.quotaId)?.period;

  const quick = (quota: Quota) => {
    const p = paymentOf(quota);
    if (!p) return;
    try {
      review(p.id, "aprovado");
      toast.success(`Pagamento validado — ${aptLabel(apartments, quota.apartmentId)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível validar.");
    }
  };

  const exportCsv = () => {
    if (tab === "historico") {
      downloadCsv("laguna-historico-comprovativos-demo.csv", [
        ["Bloco", "Apartamento", "Trimestre", "Referência", "Método", "Data do pagamento", "Valor (Kz)", "Estado"],
        ...history.map((p) => {
          const a = aptOf(p.apartmentId);
          const per = periodOf(p);
          return [a?.block ?? "", a?.number ?? "", per ? formatQuarter(per) : "", p.reference || "—", METHOD_LABELS[p.method], formatDate(p.paidAt), p.amount, statusLabel(p.status)];
        }),
      ]);
    } else {
      downloadCsv("laguna-quotas-trimestrais-demo.csv", [
        ["Bloco", "Apartamento", "Morador", "Trimestre", "Ano", "Data limite", "Valor (Kz)", "Estado"],
        ...quotaRows.map((x) => {
          const a = aptOf(x.apartmentId);
          return [a?.block ?? "", a?.number ?? "", resOf(x.apartmentId), `${x.quarter}.º Trimestre`, x.year, formatDate(x.dueDate), x.amount, statusLabel(x.status)];
        }),
      ]);
    }
    toast.success("Ficheiro CSV exportado (dados de demonstração).");
  };

  return (
    <>
      <PageHeader
        eyebrow="Financeiro"
        title="Pagamentos e comprovativos"
        description="Validação de comprovativos (Gestor Operacional ou Gestor Financeiro — uma única decisão por comprovativo) e consulta das quotas trimestrais por bloco, apartamento, trimestre e ano."
        actions={
          <div className="flex flex-wrap gap-2">
            {canRegister && (
              <Button onClick={() => setRegistering(true)}>
                <Plus className="h-4 w-4" /> Registar pagamento
              </Button>
            )}
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} highlight label="Total recebido" value={formatKz(f.received)} icon={CircleDollarSign} />
        <StatCard index={1} label="Em validação" value={f.analysisCount} icon={Hourglass} tone="gold" hint={formatKz(f.analysis)} />
        <StatCard index={2} label="Pendente (no prazo)" value={formatKz(f.pending)} icon={Clock} tone="info" hint={`${f.pendingCount} quotas`} />
        <StatCard index={3} label="Em atraso" value={formatKz(f.overdue)} icon={AlertTriangle} tone="warning" hint={`${f.overdueCount} quotas`} />
      </div>

      <Card>
        <Toolbar>
          <Tabs<TabId>
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "em_analise", label: "Em validação", count: count("em_analise") },
              { id: "pendente", label: "Pendentes", count: count("pendente") },
              { id: "parcial", label: "Parciais", count: count("parcial") },
              { id: "em_atraso", label: "Em atraso", count: count("em_atraso") },
              { id: "pago", label: "Pagas", count: count("pago") },
              { id: "todos", label: "Todas" },
              { id: "historico", label: "Histórico de comprovativos" },
            ]}
          />
        </Toolbar>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Morador ou referência…" className="sm:w-64" />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select value={block} onChange={(e) => setBlock(e.target.value)} className="sm:w-36" aria-label="Bloco">
              <option value="">Todos os blocos</option>
              {BLOCKS.map((b) => (
                <option key={b} value={b}>
                  Bloco {b}
                </option>
              ))}
            </Select>
            <Input value={apt} onChange={(e) => setApt(e.target.value)} placeholder="Apartamento" className="sm:w-32" aria-label="Apartamento" inputMode="numeric" />
            <Select value={quarter} onChange={(e) => setQuarter(e.target.value)} className="sm:w-40" aria-label="Trimestre">
              <option value="">Todos os trimestres</option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}.º Trimestre
                </option>
              ))}
            </Select>
            <Select value={year} onChange={(e) => setYear(e.target.value)} className="sm:w-32" aria-label="Ano">
              <option value="">Todos os anos</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
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
              { key: "apt", header: "Fracção", primary: true, cell: (p) => <span className="font-semibold text-navy-900">{aptLabel(apartments, p.apartmentId)}</span> },
              { key: "per", header: "Trimestre", cell: (p) => (periodOf(p) ? formatQuarter(periodOf(p)!, "short") : "—") },
              { key: "ref", header: "Referência", cell: (p) => <span className="font-mono text-xs">{p.reference || "—"}</span> },
              { key: "method", header: "Método", cell: (p) => METHOD_LABELS[p.method], hideOnMobile: true },
              { key: "date", header: "Pagamento", cell: (p) => formatDate(p.paidAt) },
              { key: "amount", header: "Valor", align: "right", cell: (p) => <span className="font-medium tabular-nums">{formatKz(p.amount)}</span> },
              { key: "status", header: "Comprovativo", cell: (p) => <StatusBadge status={p.status} /> },
              { key: "by", header: "Decidido por", hideOnMobile: true, cell: (p) => (p.reviewedBy ? <span className="text-xs">{p.reviewedBy}{p.reviewedByRole ? <span className="block text-graphite-400">{roleLabels[p.reviewedByRole]}</span> : null}</span> : "—") },
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
            emptyTitle={tab === "em_analise" ? "Sem comprovativos por validar" : "Sem resultados"}
            columns={[
              { key: "apt", header: "Fracção", primary: true, cell: (x) => <span className="font-semibold text-navy-900">{aptLabel(apartments, x.apartmentId)}</span> },
              { key: "res", header: "Morador", cell: (x) => resOf(x.apartmentId) },
              { key: "period", header: "Trimestre", cell: (x) => `${x.quarter}.º Trim.` },
              { key: "year", header: "Ano", cell: (x) => x.year },
              { key: "due", header: "Data limite", cell: (x) => formatDate(x.dueDate), hideOnMobile: true },
              { key: "typ", header: "Tipologia", cell: (x) => x.typology, hideOnMobile: true },
              { key: "amount", header: "Valor", align: "right", cell: (x) => <span className="font-medium tabular-nums">{formatKz(x.amount)}{x.paidAmount > 0 && x.paidAmount < x.amount ? <span className="block text-[11px] text-graphite-500">pago {formatKz(x.paidAmount)}</span> : null}</span> },
              { key: "status", header: "Estado", cell: (x) => <StatusBadge status={x.status} /> },
              {
                key: "actions",
                header: "",
                align: "right",
                cell: (x) => (
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {x.status === "em_analise" && (
                      <>
                        <IconBtn label="Validar pagamento" onClick={() => quick(x)}>
                          <Check className="h-4 w-4 text-emerald-700" />
                        </IconBtn>
                        <IconBtn label="Rejeitar comprovativo" danger onClick={() => setSelected(paymentOf(x) ?? null)}>
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
      {canRegister && <RegisterPaymentModal open={registering} onClose={() => setRegistering(false)} />}
    </>
  );
}
