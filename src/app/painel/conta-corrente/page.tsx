"use client";

import { useMemo, useState } from "react";
import { useDemoStore } from "@/store/demo-store";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AccountStatement } from "@/components/app/widgets/account-statement";

export default function ContaCorrentePage() {
  const apartments = useDemoStore((s) => s.apartments);
  const occupied = useMemo(() => apartments.filter((a) => a.residentId).sort((a, b) => (a.block + a.number).localeCompare(b.block + b.number)), [apartments]);
  const [aptId, setAptId] = useState(occupied[0]?.id ?? "");

  return (
    <>
      <PageHeader eyebrow="Financeiro" title="Conta corrente" description="Movimentos e saldo por apartamento." />
      <Card className="mb-6">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
          <Field label="Apartamento" className="sm:w-80">
            <Select value={aptId} onChange={(e) => setAptId(e.target.value)}>
              {occupied.map((a) => (
                <option key={a.id} value={a.id}>
                  Bloco {a.block} · {a.number}{a.typology ? ` · ${a.typology}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <DemoDataNote className="sm:ml-auto" />
        </div>
      </Card>
      {aptId ? <AccountStatement apartmentId={aptId} /> : <EmptyState title="Seleccione um apartamento" />}
    </>
  );
}
