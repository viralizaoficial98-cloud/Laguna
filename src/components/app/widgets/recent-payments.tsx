"use client";

import { useMemo, useState } from "react";
import type { Payment } from "@/types";
import { useDemoStore, aptLabel } from "@/store/demo-store";
import { formatDate, formatKz, formatQuarter } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { METHOD_LABELS, ReviewPaymentModal } from "./review-payment-modal";

export function RecentPayments({ limit = 8 }: { limit?: number }) {
  const payments = useDemoStore((s) => s.payments);
  const apartments = useDemoStore((s) => s.apartments);
  const quotas = useDemoStore((s) => s.quotas);
  const [sel, setSel] = useState<Payment | null>(null);
  const rows = useMemo(() => [...payments].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, limit), [payments, limit]);

  return (
    <Card>
      <CardHeader title="Histórico de transacções recentes" description="Últimos pagamentos registados" />
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={setSel}
        pageSize={limit}
        columns={[
          { key: "apt", header: "Apartamento", primary: true, cell: (r) => <span className="font-medium text-navy-900">{aptLabel(apartments, r.apartmentId)}</span> },
          { key: "period", header: "Trimestre", cell: (r) => { const per = quotas.find((q) => q.id === r.quotaId)?.period; return per ? formatQuarter(per, "short") : "—"; } },
          { key: "method", header: "Método", cell: (r) => METHOD_LABELS[r.method], hideOnMobile: true },
          { key: "date", header: "Data", cell: (r) => formatDate(r.submittedAt) },
          { key: "amount", header: "Valor", align: "right", cell: (r) => <span className="font-medium tabular-nums">{formatKz(r.amount)}</span> },
          { key: "status", header: "Estado", cell: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
      <ReviewPaymentModal payment={sel} onClose={() => setSel(null)} />
    </Card>
  );
}
