"use client";

import { useMemo, useState } from "react";
import type { Payment } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { useCurrentResident } from "@/hooks/use-session";
import { cn, formatDate, formatDateTime, formatKz, formatQuarter } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Modal } from "@/components/ui/modal";
import { METHOD_LABELS, ProofPreview } from "@/components/app/widgets/review-payment-modal";

export default function MeusPagamentosPage() {
  const { apartment } = useCurrentResident();
  const payments = useDemoStore((s) => s.payments);
  const quotas = useDemoStore((s) => s.quotas);
  const [sel, setSel] = useState<Payment | null>(null);
  const rows = useMemo(() => payments.filter((p) => p.apartmentId === apartment?.id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)), [payments, apartment]);
  const period = (p: Payment) => quotas.find((q) => q.id === p.quotaId)?.period;

  return (
    <>
      <PageHeader eyebrow="Minha área" title="Pagamentos" description="Histórico e acompanhamento do estado dos seus pagamentos." />
      <Card>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={setSel}
          emptyTitle="Ainda não registou pagamentos"
          columns={[
            { key: "period", header: "Quota trimestral", primary: true, cell: (p) => <span className="font-medium text-navy-900">{period(p) ? formatQuarter(period(p)!) : "—"}</span> },
            { key: "ref", header: "Referência", cell: (p) => <span className="font-mono text-xs">{p.reference || "—"}</span> },
            { key: "method", header: "Método", cell: (p) => METHOD_LABELS[p.method], hideOnMobile: true },
            { key: "paid", header: "Data do pagamento", cell: (p) => formatDate(p.paidAt) },
            { key: "date", header: "Enviado", cell: (p) => formatDate(p.submittedAt), hideOnMobile: true },
            { key: "amount", header: "Valor", align: "right", cell: (p) => <span className="font-medium tabular-nums">{formatKz(p.amount)}</span> },
            { key: "status", header: "Estado", cell: (p) => <StatusBadge status={p.status} /> },
          ]}
        />
      </Card>
      <Modal open={!!sel} onClose={() => setSel(null)} size="lg" title="Detalhe do pagamento" description={sel ? `${sel.reference || "Sem referência"} · ${formatKz(sel.amount)}` : ""}>
        {sel && (
          <div className="grid gap-6 md:grid-cols-2">
            <ol className="relative space-y-6 border-l border-graphite-200 pl-6">
              <TimelineItem done title="Comprovativo enviado" date={formatDateTime(sel.submittedAt)} />
              <TimelineItem done={sel.status !== "em_analise"} active={sel.status === "em_analise"} title="Em análise pela Administração" date={sel.status === "em_analise" ? "A aguardar" : ""} />
              <TimelineItem
                done={sel.status === "aprovado"}
                error={sel.status === "rejeitado"}
                title={sel.status === "rejeitado" ? "Comprovativo rejeitado" : "Pagamento validado"}
                date={sel.reviewedAt ? `${formatDateTime(sel.reviewedAt)} · ${sel.reviewedBy}` : ""}
                note={sel.note}
              />
            </ol>
            <ProofPreview payment={sel} />
          </div>
        )}
      </Modal>
    </>
  );
}

function TimelineItem({ title, date, done, active, error, note }: { title: string; date?: string; done?: boolean; active?: boolean; error?: boolean; note?: string }) {
  return (
    <li className="relative">
      <span className={cn("absolute top-0.5 -left-[31px] h-4 w-4 rounded-full ring-4 ring-white", error ? "bg-red-500" : done ? "bg-emerald-500" : active ? "animate-pulse bg-sky-500" : "bg-graphite-200")} />
      <p className={cn("text-sm font-medium", done || active || error ? "text-navy-900" : "text-graphite-400")}>{title}</p>
      {date && <p className="text-xs text-graphite-500">{date}</p>}
      {note && <p className="mt-1 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">{note}</p>}
    </li>
  );
}
