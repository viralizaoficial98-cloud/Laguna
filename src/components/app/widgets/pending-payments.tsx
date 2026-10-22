"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Payment } from "@/types";
import { useDemoStore, aptLabel } from "@/store/demo-store";
import { formatDate, formatKz } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ReviewPaymentModal } from "./review-payment-modal";

export function PendingPayments({ limit = 5 }: { limit?: number }) {
  const payments = useDemoStore((s) => s.payments);
  const apartments = useDemoStore((s) => s.apartments);
  const residents = useDemoStore((s) => s.residents);
  const [selected, setSelected] = useState<Payment | null>(null);
  const pending = useMemo(() => payments.filter((p) => p.status === "em_analise").sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)), [payments]);

  return (
    <Card>
      <CardHeader
        title="Pagamentos a aguardar aprovação"
        description={`${pending.length} comprovativos em análise`}
        action={
          <Link href="/painel/pagamentos" className="inline-flex items-center gap-1 text-xs font-medium text-navy-700 hover:text-navy-900">
            Ver todos <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      {pending.length === 0 ? (
        <EmptyState title="Tudo em dia" description="Não existem comprovativos a aguardar aprovação." />
      ) : (
        <ul className="divide-y divide-graphite-100">
          {pending.slice(0, limit).map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-navy-900">
                  {aptLabel(apartments, p.apartmentId)} <span className="font-normal text-graphite-500">· {residents.find((r) => r.id === p.residentId)?.name ?? "—"}</span>
                </p>
                <p className="text-xs text-graphite-500">
                  {formatKz(p.amount)} · {p.reference || "sem referência"} · {formatDate(p.submittedAt)}
                </p>
              </div>
              <Button size="sm" variant="subtle" onClick={() => setSelected(p)}>
                Analisar
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ReviewPaymentModal payment={selected} onClose={() => setSelected(null)} />
    </Card>
  );
}
