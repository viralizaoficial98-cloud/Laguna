"use client";

import { FileText, ImageIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { Payment } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { useCurrentResident } from "@/hooks/use-session";
import { formatBytes, formatDate, formatKz, formatQuarter } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { ProofPreview } from "@/components/app/widgets/review-payment-modal";

export default function ComprovativosPage() {
  const { apartment } = useCurrentResident();
  const payments = useDemoStore((s) => s.payments);
  const quotas = useDemoStore((s) => s.quotas);
  const [sel, setSel] = useState<Payment | null>(null);
  const list = useMemo(() => payments.filter((p) => p.apartmentId === apartment?.id && p.proof).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)), [payments, apartment]);

  return (
    <>
      <PageHeader eyebrow="Minha área" title="Comprovativos" description="Comprovativos de pagamento enviados para a administração." />
      {list.length === 0 ? (
        <div className="rounded-3xl border border-graphite-100 bg-white">
          <EmptyState title="Sem comprovativos" description="Os comprovativos enviados aparecem aqui." />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const isImg = p.proof?.type.startsWith("image/");
            const q = quotas.find((x) => x.id === p.quotaId);
            return (
              <button key={p.id} onClick={() => setSel(p)} className="group flex items-start gap-4 rounded-2xl border border-graphite-100 bg-white p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-700 transition group-hover:bg-navy-900 group-hover:text-gold-300">
                  {isImg ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-navy-900">{p.proof?.name}</span>
                  <span className="block text-xs text-graphite-500">
                    {q ? formatQuarter(q.period) : ""} · {formatKz(p.amount)}
                  </span>
                  <span className="mt-2 flex items-center justify-between gap-2">
                    <StatusBadge status={p.status} />
                    <span className="text-[11px] text-graphite-400">
                      {formatDate(p.submittedAt)} · {formatBytes(p.proof?.size ?? 0)}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      <Modal open={!!sel} onClose={() => setSel(null)} size="lg" title={sel?.proof?.name ?? ""} description={sel ? `Referência ${sel.reference}` : ""}>
        {sel && <ProofPreview payment={sel} />}
      </Modal>
    </>
  );
}
