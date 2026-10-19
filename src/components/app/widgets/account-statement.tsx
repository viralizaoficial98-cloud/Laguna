"use client";

import { Download, Printer } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { useDemoStore, aptLabel } from "@/store/demo-store";
import { CURRENT_PERIOD } from "@/hooks/use-finance";
import { cn, downloadCsv, formatDate, formatKz, formatQuarter } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";

interface Movement {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  status: string;
}

/** Extracto de conta corrente: débitos (quotas emitidas) e créditos (pagamentos aprovados). */
export function AccountStatement({ apartmentId }: { apartmentId: string }) {
  const quotas = useDemoStore((s) => s.quotas);
  const payments = useDemoStore((s) => s.payments);
  const apartments = useDemoStore((s) => s.apartments);
  const residents = useDemoStore((s) => s.residents);
  const apt = apartments.find((a) => a.id === apartmentId);
  const resident = residents.find((r) => r.id === apt?.residentId);

  const { movements, debit, credit } = useMemo(() => {
    const list: Movement[] = [];
    quotas
      .filter((q) => q.apartmentId === apartmentId && q.period <= CURRENT_PERIOD)
      .forEach((q) => list.push({ id: q.id, date: q.dueDate, description: `Quota do ${formatQuarter(q.period)}`, debit: q.amount, credit: 0, status: q.status }));
    payments
      .filter((p) => p.apartmentId === apartmentId && p.status === "aprovado")
      .forEach((p) => list.push({ id: p.id, date: p.paidAt.slice(0, 10), description: `Pagamento ${p.reference}`, debit: 0, credit: p.amount, status: "aprovado" }));
    list.sort((a, b) => a.date.localeCompare(b.date) || b.debit - a.debit);
    return { movements: list, debit: list.reduce((a, m) => a + m.debit, 0), credit: list.reduce((a, m) => a + m.credit, 0) };
  }, [quotas, payments, apartmentId]);

  const rows = movements.reduce<(Movement & { balance: number })[]>((acc, m) => {
    const prev = acc.at(-1)?.balance ?? 0;
    acc.push({ ...m, balance: prev + m.debit - m.credit });
    return acc;
  }, []);
  const balance = debit - credit;

  const exportCsv = () => {
    downloadCsv(`conta-corrente-${aptLabel(apartments, apartmentId)}-demo.csv`, [
      ["Data", "Descrição", "Débito (Kz)", "Crédito (Kz)", "Saldo (Kz)"],
      ...rows.map((r) => [formatDate(r.date), r.description, r.debit || "", r.credit || "", r.balance]),
    ]);
    toast.success("Extracto exportado (CSV).");
  };

  return (
    <Card className="print-area">
      <CardHeader
        title={`Extracto — Apartamento ${aptLabel(apartments, apartmentId)}`}
        description={`${resident?.name ?? "Sem morador"} · até ao ${formatQuarter(CURRENT_PERIOD)}`}
        action={
          <div className="no-print flex gap-2">
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> Imprimir
            </Button>
          </div>
        }
      />
      <div className="grid gap-px bg-graphite-100 sm:grid-cols-3">
        {[
          ["Total debitado", formatKz(debit), "text-navy-900"],
          ["Total creditado", formatKz(credit), "text-emerald-700"],
          [balance > 0 ? "Saldo devedor" : "Saldo", formatKz(Math.abs(balance)), balance > 0 ? "text-amber-700" : "text-emerald-700"],
        ].map(([k, v, c]) => (
          <div key={k} className="bg-white px-5 py-4">
            <p className="text-xs text-graphite-500">{k}</p>
            <p className={cn("mt-1 text-xl font-semibold tabular-nums", c)}>{v}</p>
          </div>
        ))}
      </div>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-y border-graphite-100 bg-graphite-50/70 text-[11px] tracking-wider text-graphite-500 uppercase">
              <th className="px-4 py-3 text-left">Data</th>
              <th className="px-4 py-3 text-left">Descrição</th>
              <th className="px-4 py-3 text-right">Débito</th>
              <th className="px-4 py-3 text-right">Crédito</th>
              <th className="px-4 py-3 text-right">Saldo</th>
              <th className="px-4 py-3 text-left">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-graphite-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-navy-50/30">
                <td className="px-4 py-2.5 text-graphite-600">{formatDate(r.date)}</td>
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
