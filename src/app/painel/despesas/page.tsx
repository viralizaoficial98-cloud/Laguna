"use client";

import { Plus, Trash2, Wallet, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { ExpenseCategory } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { useSession } from "@/hooks/use-session";
import { can } from "@/config/permissions";
import { EXPENSE_CATEGORIES } from "@/data/operations";
import { downloadCsv, formatDate, formatKz, formatQuarter, quarterOf, todayISO } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { StatCard } from "@/components/ui/stat-card";
import { IconBtn } from "@/components/ui/icon-button";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { Donut } from "@/components/charts/charts";

/** Despesas do condomínio — registo e categorização pelo Gestor Financeiro; consulta pela Administração. */
export default function DespesasPage() {
  const session = useSession();
  const expenses = useDemoStore((s) => s.expenses);
  const add = useDemoStore((s) => s.addExpense);
  const remove = useDemoStore((s) => s.deleteExpense);
  const manage = can(session?.role, "expenses.manage");
  const periods = useMemo(() => Array.from(new Set(expenses.map((e) => e.period))).sort().reverse(), [expenses]);
  const [period, setPeriod] = useState(quarterOf(todayISO()));
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: todayISO(), category: "Manutenção" as ExpenseCategory, description: "", amount: "" });

  const rows = expenses.filter((e) => (!period || e.period === period) && (!cat || e.category === cat)).sort((a, b) => b.date.localeCompare(a.date));
  const total = rows.reduce((a, e) => a + e.amount, 0);
  const maint = rows.filter((e) => e.category === "Manutenção" || e.category === "Elevadores").reduce((a, e) => a + e.amount, 0);

  const submit = () => {
    if (!form.description.trim() || !Number(form.amount)) return toast.error("Indique a descrição e o valor.");
    try {
      add({ date: form.date, category: form.category, description: form.description.trim(), amount: Number(form.amount) });
      toast.success("Despesa registada");
      setOpen(false);
      setForm({ ...form, description: "", amount: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Financeiro"
        title="Despesas"
        description={manage ? "Registo e categorização das despesas do condomínio." : "Consulta das despesas registadas pelo Gestor Financeiro (supervisão)."}
        actions={
          <div className="flex gap-2">
            {manage && (
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> Registar despesa
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => downloadCsv("laguna-despesas-demo.csv", [["Data", "Trimestre", "Categoria", "Descrição", "Valor (Kz)"], ...rows.map((e) => [formatDate(e.date), formatQuarter(e.period), e.category, e.description, e.amount])])}
            >
              Exportar CSV
            </Button>
          </div>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Trimestre" className="sm:w-56">
          <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="">Todos</option>
            {periods.map((p) => (
              <option key={p} value={p}>
                {formatQuarter(p)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Categoria" className="sm:w-56">
          <Select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Todas</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <DemoDataNote className="sm:ml-auto" />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard index={0} highlight label="Total de despesas" value={formatKz(total)} icon={Wallet} />
        <StatCard index={1} label="Despesas operacionais" value={formatKz(total - maint)} icon={Wallet} tone="info" />
        <StatCard index={2} label="Despesas de manutenção" value={formatKz(maint)} icon={Wrench} tone="gold" hint="manutenção e elevadores" />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <DataTable
            rows={rows}
            rowKey={(e) => e.id}
            columns={[
              { key: "d", header: "Data", cell: (e) => formatDate(e.date) },
              { key: "c", header: "Categoria", cell: (e) => e.category },
              { key: "desc", header: "Descrição", primary: true, cell: (e) => <span className="font-medium text-navy-900">{e.description}</span> },
              { key: "v", header: "Valor", align: "right", cell: (e) => <span className="tabular-nums">{formatKz(e.amount)}</span> },
              ...(manage
                ? [
                    {
                      key: "x",
                      header: "",
                      align: "right" as const,
                      cell: (e: (typeof rows)[number]) => (
                        <IconBtn label="Eliminar despesa" danger onClick={() => (remove(e.id), toast.success("Despesa eliminada"))}>
                          <Trash2 className="h-4 w-4" />
                        </IconBtn>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Distribuição por categoria" />
          <CardBody>
            <Donut data={EXPENSE_CATEGORIES.map((c) => ({ key: c, label: c, value: rows.filter((e) => e.category === c).reduce((a, e) => a + e.amount, 0) })).filter((x) => x.value > 0)} centerValue={String(rows.length)} centerLabel="registos" />
          </CardBody>
        </Card>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Registar despesa"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit}>Guardar</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Categoria">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Descrição" className="sm:col-span-2">
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Valor (Kz)">
            <Input type="number" min={1} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
