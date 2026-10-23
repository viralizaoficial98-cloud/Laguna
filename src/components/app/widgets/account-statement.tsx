"use client";

import { Download, FileDown, Printer } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { useDemoStore, aptLabel } from "@/store/demo-store";
import { CURRENT_PERIOD } from "@/hooks/use-finance";
import { computeAccount } from "@/lib/account";
import { cn, downloadCsv, formatDate, formatKz, formatQuarter } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";

/**
 * Conta corrente da fracção (período de ocupação do morador actual):
 * quotas, pagamentos validados, encargos e reservas — cálculo único em `computeAccount`.
 */
export function AccountStatement({ apartmentId }: { apartmentId: string }) {
  const quotas = useDemoStore((s) => s.quotas);
  const payments = useDemoStore((s) => s.payments);
  const charges = useDemoStore((s) => s.charges);
  const reservations = useDemoStore((s) => s.reservations);
  const occupancies = useDemoStore((s) => s.occupancies);
  const apartments = useDemoStore((s) => s.apartments);
  const residents = useDemoStore((s) => s.residents);
  const apt = apartments.find((a) => a.id === apartmentId);
  const resident = residents.find((r) => r.id === apt?.residentId);
  const occupancy = occupancies.find((o) => o.apartmentId === apartmentId && o.residentId === resident?.id && !o.to);

  const acc = useMemo(() => computeAccount({ apartmentId, quotas, payments, charges, reservations, occupancy }), [apartmentId, quotas, payments, charges, reservations, occupancy]);
  const label = aptLabel(apartments, apartmentId);

  const exportCsv = () => {
    downloadCsv(`conta-corrente-${label}-demo.csv`, [
      ["Data", "Origem", "Descrição", "Débito (Kz)", "Crédito (Kz)", "Saldo (Kz)"],
      ...acc.lines.map((r) => [formatDate(r.date), r.origin, r.description, r.debit || "", r.credit || "", r.balance]),
    ]);
    toast.success("Extracto exportado (CSV).");
  };
  const exportPdf = () =>
    import("@/lib/finance-docs").then((m) =>
      m.downloadStatement({ ref: `Conta corrente ${label}`, resident: resident?.name ?? "Sem morador", apartment: label, typology: apt?.typology ?? "—", from: occupancy?.from }, acc),
    );

  return (
    <Card className="print-area">
      <CardHeader
        title={`Extracto — ${label}${apt ? ` · ${apt.typology}` : ""}`}
        description={`${resident?.name ?? "Sem morador"}${occupancy ? ` · desde ${formatDate(occupancy.from)}` : ""} · até ao ${formatQuarter(CURRENT_PERIOD)}`}
        action={
          <div className="no-print flex flex-wrap gap-2">
            <Button size="sm" onClick={exportPdf}>
              <FileDown className="h-3.5 w-3.5" /> Extracto PDF
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> Imprimir
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-px bg-graphite-100 lg:grid-cols-4">
        {[
          ["Quotas emitidas", acc.quotasTotal, "text-navy-900"],
          ["Valores pagos", acc.paidTotal, "text-emerald-700"],
          ["Em validação", acc.inValidation, "text-sky-700"],
          ["Dívida vencida", acc.overdue, acc.overdue ? "text-amber-700" : "text-emerald-700"],
          ["Quotas vincendas", acc.upcoming, "text-graphite-700"],
          ["Encargos por liquidar", acc.charges, acc.charges ? "text-amber-700" : "text-graphite-700"],
          ["Reservas por liquidar", acc.reservationsUnpaid, acc.reservationsUnpaid ? "text-amber-700" : "text-graphite-700"],
          ["Créditos / antecipados", acc.credits, "text-emerald-700"],
        ].map(([k, v, c]) => (
          <div key={k as string} className="bg-white px-5 py-4">
            <p className="text-xs text-graphite-500">{k}</p>
            <p className={cn("mt-1 text-lg font-semibold tabular-nums", c as string)}>{formatKz(v as number)}</p>
          </div>
        ))}
      </div>
      <div className={cn("flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm", acc.confirmedDebt ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900")} data-testid="account-final">
        <span className="font-medium">{acc.confirmedDebt ? "Dívida confirmada" : "Sem dívida confirmada"}</span>
        <span className="font-semibold tabular-nums">{formatKz(acc.confirmedDebt)}</span>
      </div>
      {acc.openItems.length > 0 && (
        <ul className="divide-y divide-graphite-100 border-b border-graphite-100 text-sm">
          {acc.openItems.map((o, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-5 py-2">
              <span>
                <span className="mr-2 rounded-md bg-graphite-100 px-1.5 py-0.5 text-[11px] text-graphite-600">{o.origin}</span>
                {o.description}
              </span>
              <span className="font-medium tabular-nums">{formatKz(o.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-y border-graphite-100 bg-graphite-50/70 text-[11px] tracking-wider text-graphite-500 uppercase">
              <th className="px-4 py-3 text-left">Data</th>
              <th className="px-4 py-3 text-left">Origem</th>
              <th className="px-4 py-3 text-left">Descrição</th>
              <th className="px-4 py-3 text-right">Débito</th>
              <th className="px-4 py-3 text-right">Crédito</th>
              <th className="px-4 py-3 text-right">Saldo</th>
              <th className="px-4 py-3 text-left">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-graphite-100">
            {acc.lines.map((r) => (
              <tr key={r.id} className="hover:bg-navy-50/30">
                <td className="px-4 py-2.5 text-graphite-600">{formatDate(r.date)}</td>
                <td className="px-4 py-2.5 text-xs text-graphite-500">{r.origin}</td>
                <td className="px-4 py-2.5 font-medium text-navy-900">{r.description}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.debit ? formatKz(r.debit) : ""}</td>
                <td className="px-4 py-2.5 text-right text-emerald-700 tabular-nums">{r.credit ? formatKz(r.credit) : ""}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">{formatKz(r.balance)}</td>
                <td className="px-4 py-2.5">{r.debit ? <StatusBadge status={r.status} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
