"use client";

import { useMemo, useState } from "react";
import { useDemoStore } from "@/store/demo-store";
import { BLOCKS } from "@/data/management";
import { computeAccount } from "@/lib/account";
import { formatKz } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable } from "@/components/ui/data-table";
import { AccountStatement } from "@/components/app/widgets/account-statement";

export default function ContaCorrentePage() {
  const apartments = useDemoStore((s) => s.apartments);
  const residents = useDemoStore((s) => s.residents);
  const quotas = useDemoStore((s) => s.quotas);
  const payments = useDemoStore((s) => s.payments);
  const charges = useDemoStore((s) => s.charges);
  const reservations = useDemoStore((s) => s.reservations);
  const [block, setBlock] = useState("01");
  const list = useMemo(() => apartments.filter((a) => a.active && a.block === block).sort((a, b) => a.number.localeCompare(b.number)), [apartments, block]);
  const [aptId, setAptId] = useState("");
  const current = list.find((a) => a.id === aptId) ? aptId : (list[0]?.id ?? "");

  // dívida por apartamento (todas as fracções, quotas vencidas + encargos + reservas)
  const debts = useMemo(
    () =>
      apartments
        .filter((a) => a.active)
        .map((a) => ({ apt: a, acc: computeAccount({ apartmentId: a.id, quotas, payments, charges, reservations }) }))
        .filter((x) => x.acc.confirmedDebt > 0)
        .sort((a, b) => b.acc.confirmedDebt - a.acc.confirmedDebt),
    [apartments, quotas, payments, charges, reservations],
  );

  return (
    <>
      <PageHeader eyebrow="Financeiro" title="Conta corrente" description="Movimentos, valores em aberto e saldo por apartamento. Extracto em PDF." />
      <Card className="mb-6">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
          <Field label="Bloco" className="sm:w-40">
            <Select value={block} onChange={(e) => setBlock(e.target.value)}>
              {BLOCKS.map((b) => (
                <option key={b} value={b}>
                  Bloco {b}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Apartamento" className="sm:w-80">
            <Select value={current} onChange={(e) => setAptId(e.target.value)} aria-label="Apartamento">
              {list.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.number} · {a.typology} · {residents.find((r) => r.id === a.residentId)?.name ?? "sem morador"}
                </option>
              ))}
            </Select>
          </Field>
          <DemoDataNote className="sm:ml-auto" />
        </div>
      </Card>
      {current ? <AccountStatement apartmentId={current} /> : <EmptyState title="Seleccione um apartamento" />}
      <Card className="mt-6">
        <CardHeader title="Dívidas por apartamento" description={`${debts.length} fracções com dívida confirmada · total ${formatKz(debts.reduce((a, d) => a + d.acc.confirmedDebt, 0))}`} />
        <DataTable
          rows={debts}
          rowKey={(r) => r.apt.id}
          onRowClick={(r) => {
            setBlock(r.apt.block);
            setAptId(r.apt.id);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          columns={[
            { key: "apt", header: "Fracção", primary: true, cell: (r) => <span className="font-semibold text-navy-900">Bloco {r.apt.block} · {r.apt.number}</span> },
            { key: "typ", header: "Tipologia", cell: (r) => r.apt.typology },
            { key: "res", header: "Morador", cell: (r) => residents.find((x) => x.id === r.apt.residentId)?.name ?? "—" },
            { key: "ov", header: "Quotas vencidas", align: "right", cell: (r) => formatKz(r.acc.overdue) },
            { key: "ot", header: "Outros", align: "right", hideOnMobile: true, cell: (r) => formatKz(r.acc.charges + r.acc.reservationsUnpaid) },
            { key: "tot", header: "Dívida", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatKz(r.acc.confirmedDebt)}</span> },
          ]}
        />
      </Card>
    </>
  );
}
