"use client";

import { Ban, CheckCircle2, FileDown, FileSpreadsheet, HandCoins, History, Pencil, Plus, Receipt, Trash2, Wallet, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Expense, ExpenseCategory, PaymentMethod, PaymentProof } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { useSession } from "@/hooks/use-session";
import { useApi } from "@/hooks/use-api";
import { can } from "@/config/permissions";
import { EXPENSE_CATEGORIES } from "@/data/operations";
import { fileSrc } from "@/lib/api-client";
import { downloadXlsx } from "@/lib/excel-export";
import { formatDate, formatDateTime, formatKz, formatQuarter, includesText, todayISO } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { IconBtn } from "@/components/ui/icon-button";
import { SearchInput } from "@/components/ui/search-input";
import { Toolbar } from "@/components/ui/toolbar";
import { Tabs } from "@/components/ui/tabs";
import { Donut, GroupedBars, HBars } from "@/components/charts/charts";
import { ProofInput } from "@/components/app/widgets/proof-input";
import { METHOD_LABELS } from "@/components/app/widgets/review-payment-modal";

type Status = NonNullable<Expense["status"]> | "legado";
const statusOf = (e: Expense): Status => e.status ?? "legado";
const total = (e: Expense) => e.netAmount ?? e.amount;
interface BudgetLineOpt {
  id: string;
  name: string;
  kind: string;
  isGroup: boolean;
}

/** Despesas do condomínio: fornecedores, facturas, IVA, retenção, rubricas, estados, pagamentos e relatórios. */
export default function DespesasPage() {
  const session = useSession();
  const expenses = useDemoStore((s) => s.expenses);
  const suppliers = useDemoStore((s) => s.suppliers);
  const approve = useDemoStore((s) => s.approveExpense);
  const remove = useDemoStore((s) => s.deleteExpense);
  const manage = can(session?.role, "expenses.manage");
  const year = new Date().getFullYear();
  const { data: budget } = useApi<{ lines: BudgetLineOpt[] }>(can(session?.role, "budget.view") ? `/api/budget?year=${year}` : null);
  const lines = useMemo(() => (budget?.lines ?? []).filter((l) => !l.isGroup && l.kind === "despesa"), [budget]);
  const lineName = (id?: string) => lines.find((l) => l.id === id)?.name;

  const [tab, setTab] = useState<"lista" | "relatorios">("lista");
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [supplier, setSupplier] = useState("");
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [paying, setPaying] = useState<Expense | null>(null);
  const [voiding, setVoiding] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [detail, setDetail] = useState<Expense | null>(null);

  const periods = useMemo(() => Array.from(new Set(expenses.map((e) => e.period))).sort().reverse(), [expenses]);
  const months = useMemo(() => Array.from(new Set(expenses.map((e) => e.date.slice(0, 7)))).sort().reverse(), [expenses]);
  const rows = useMemo(
    () =>
      expenses
        .filter((e) => (!period || e.period === period || e.date.startsWith(period)) && (!cat || e.category === cat) && (!status || statusOf(e) === status) && (!supplier || e.supplierId === supplier))
        .filter((e) => includesText([e.description, e.supplierName, e.nif, e.invoiceRef, e.category, lineName(e.budgetLineId)], q))
        .sort((a, b) => b.date.localeCompare(a.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expenses, period, cat, status, supplier, q, lines],
  );
  const valid = rows.filter((e) => e.status !== "anulada");
  const sum = (f: (e: Expense) => number) => valid.reduce((a, e) => a + f(e), 0);
  const maint = valid.filter((e) => e.category === "Manutenção" || e.category === "Elevadores").reduce((a, e) => a + e.amount, 0);

  const act = (fn: () => void, ok: string) => {
    try {
      fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const exportRows = () =>
    rows.map((e) => [formatDate(e.date), e.supplierName ?? "", e.nif ?? "", e.invoiceRef ?? "", e.invoiceDate ?? "", e.paymentDate ?? "", e.description, e.category, lineName(e.budgetLineId) ?? "", e.costCenter ?? "", e.amount, e.vat ?? 0, e.withholding ?? 0, total(e), e.paidAmount ?? (e.status ? 0 : total(e)), statusLabel(statusOf(e))]);
  const HEAD = ["Data", "Fornecedor", "NIF", "Factura", "Data factura", "Data pagamento", "Descrição", "Categoria", "Rubrica", "Centro de custo", "Valor (Kz)", "IVA (Kz)", "Retenção (Kz)", "Líquido (Kz)", "Pago (Kz)", "Estado"];

  const exportPdf = async () => {
    const { downloadReportPdf } = await import("@/lib/report-pdf");
    const byCat = EXPENSE_CATEGORIES.map((c) => ({ c, v: valid.filter((e) => e.category === c).reduce((a, e) => a + e.amount, 0) })).filter((x) => x.v > 0);
    await downloadReportPdf({
      title: "Relatório de Despesas",
      subtitle: "Despesas, IVA, retenções e pagamentos",
      period: period ? (period.includes("-T") ? formatQuarter(period) : period) : "Todos os períodos",
      author: `${session?.name ?? ""} — ${session?.title ?? ""}`,
      fileName: `Relatorio_Despesas_${period || "todos"}.pdf`,
      kpis: [
        { label: "Despesas (valor)", value: formatKz(sum((e) => e.amount)) },
        { label: "IVA", value: formatKz(sum((e) => e.vat ?? 0)) },
        { label: "Retenção", value: formatKz(sum((e) => e.withholding ?? 0)) },
        { label: "Líquido", value: formatKz(sum(total)) },
      ],
      charts: [{ title: "Despesas por categoria", categories: byCat.map((x) => x.c), series: [{ label: "Valor", values: byCat.map((x) => x.v) }], unit: "kz" }],
      summary: [`${valid.length} despesas no período seleccionado (anuladas excluídas).`],
      pending: valid.filter((e) => e.status === "pendente" || e.status === "aprovada" || e.status === "parcialmente_paga").map((e) => `${e.description} — ${formatKz(total(e) - (e.paidAmount ?? 0))} por pagar`),
      recommendations: [],
      tables: [{ title: "Despesas", head: ["Data", "Fornecedor", "Factura", "Descrição", "Valor", "IVA", "Ret.", "Líquido"], rows: valid.map((e) => [formatDate(e.date), e.supplierName ?? "—", e.invoiceRef ?? "—", e.description, formatKz(e.amount), formatKz(e.vat ?? 0), formatKz(e.withholding ?? 0), formatKz(total(e))]) }],
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="Gestão Financeira"
        title="Despesas"
        description={manage ? "Facturas, fornecedores, IVA, retenções, rubricas orçamentais, aprovação e pagamento. Os registos pagos são anulados, nunca apagados." : "Consulta das despesas do condomínio em modo de supervisão (sem registo nem alteração)."}
        actions={
          <div className="flex flex-wrap gap-2">
            {manage && (
              <Button onClick={() => setEditing("new")}>
                <Plus className="h-4 w-4" /> Nova despesa
              </Button>
            )}
            <Button variant="outline" onClick={() => void downloadXlsx(`laguna-despesas-${period || "todas"}.xlsx`, [{ name: "Despesas", head: HEAD, rows: exportRows(), money: [10, 11, 12, 13, 14] }])}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" onClick={() => void exportPdf()}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
        <Field label="Período" className="sm:w-48">
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Período">
            <option value="">Todos</option>
            <optgroup label="Mês">
              {months.map((m) => (
                <option key={m} value={m}>
                  {new Date(`${m}-15`).toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}
                </option>
              ))}
            </optgroup>
            <optgroup label="Trimestre">
              {periods.map((p) => (
                <option key={p} value={p}>
                  {formatQuarter(p)}
                </option>
              ))}
            </optgroup>
            <optgroup label="Ano">
              {Array.from(new Set(periods.map((p) => p.slice(0, 4)))).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </optgroup>
          </Select>
        </Field>
        <Field label="Categoria" className="sm:w-48">
          <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria">
            <option value="">Todas</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Fornecedor" className="sm:w-56">
          <Select value={supplier} onChange={(e) => setSupplier(e.target.value)} aria-label="Fornecedor">
            <option value="">Todos</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Estado" className="sm:w-44">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado">
            <option value="">Todos</option>
            {(["pendente", "aprovada", "parcialmente_paga", "paga", "anulada", "legado"] as const).map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard index={0} highlight label="Despesas (valor)" value={formatKz(sum((e) => e.amount))} icon={Wallet} hint={`${valid.length} registos`} />
        <StatCard index={1} label="IVA" value={formatKz(sum((e) => e.vat ?? 0))} icon={Receipt} tone="info" />
        <StatCard index={2} label="Retenção na fonte" value={formatKz(sum((e) => e.withholding ?? 0))} icon={Receipt} tone="gold" />
        <StatCard index={3} label="Líquido pago" value={formatKz(sum((e) => e.paidAmount ?? (e.status ? 0 : total(e))))} icon={HandCoins} tone="success" hint={`por pagar ${formatKz(sum((e) => (e.status && e.status !== "paga" ? total(e) - (e.paidAmount ?? 0) : 0)))}`} />
        <StatCard index={4} label="Manutenção e elevadores" value={formatKz(maint)} icon={Wrench} tone="navy" />
      </div>
      <Tabs className="mb-4 w-fit" value={tab} onChange={setTab} tabs={[{ id: "lista", label: "Lançamentos" }, { id: "relatorios", label: "Relatórios" }]} />
      {tab === "lista" ? (
        <Card>
          <Toolbar>
            <SearchInput value={q} onChange={setQ} placeholder="Descrição, fornecedor, NIF, factura…" className="sm:w-80" />
          </Toolbar>
          <DataTable
            rows={rows}
            rowKey={(e) => e.id}
            pageSize={15}
            onRowClick={setDetail}
            columns={[
              { key: "d", header: "Data", cell: (e) => formatDate(e.paymentDate ?? e.date) },
              { key: "desc", header: "Descrição", primary: true, cell: (e) => <span className="font-medium text-navy-900">{e.description}<span className="block text-xs font-normal text-graphite-500">{e.supplierName ?? e.category}{e.invoiceRef ? ` · ${e.invoiceRef}` : ""}</span></span> },
              { key: "r", header: "Rubrica", hideOnMobile: true, cell: (e) => <span className="text-xs">{lineName(e.budgetLineId) ?? <span className="text-graphite-400">por classificar</span>}</span> },
              { key: "v", header: "Valor", align: "right", cell: (e) => <span className="tabular-nums">{formatKz(e.amount)}</span> },
              { key: "l", header: "Líquido", align: "right", hideOnMobile: true, cell: (e) => <span className="tabular-nums">{formatKz(total(e))}</span> },
              { key: "s", header: "Estado", cell: (e) => <StatusBadge status={statusOf(e) === "legado" ? "paga" : statusOf(e)} /> },
              ...(manage
                ? [
                    {
                      key: "x",
                      header: "",
                      align: "right" as const,
                      cell: (e: Expense) => (
                        <div className="flex justify-end gap-0.5" onClick={(ev) => ev.stopPropagation()}>
                          {e.status !== "anulada" && (
                            <IconBtn label="Corrigir" onClick={() => setEditing(e)}>
                              <Pencil className="h-4 w-4" />
                            </IconBtn>
                          )}
                          {e.status === "pendente" && (
                            <IconBtn label="Aprovar" onClick={() => act(() => approve(e.id), "Despesa aprovada")}>
                              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                            </IconBtn>
                          )}
                          {(e.status === "pendente" || e.status === "aprovada" || e.status === "parcialmente_paga") && (
                            <IconBtn label="Registar pagamento" onClick={() => setPaying(e)}>
                              <HandCoins className="h-4 w-4" />
                            </IconBtn>
                          )}
                          {e.status !== "anulada" && (
                            <IconBtn label="Anular" danger onClick={() => setVoiding(e)}>
                              <Ban className="h-4 w-4" />
                            </IconBtn>
                          )}
                          {e.status === "pendente" && !(e.payments ?? []).length && (
                            <IconBtn label="Eliminar" danger onClick={() => setDeleting(e)}>
                              <Trash2 className="h-4 w-4" />
                            </IconBtn>
                          )}
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </Card>
      ) : (
        <Reports rows={valid} lineName={lineName} />
      )}
      {editing && <ExpenseForm expense={editing === "new" ? null : editing} lines={lines} onClose={() => setEditing(null)} />}
      {paying && <PayModal expense={paying} onClose={() => setPaying(null)} />}
      {voiding && <VoidModal expense={voiding} onClose={() => setVoiding(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Eliminar despesa?"
        description={deleting ? `${deleting.description} — só despesas pendentes sem pagamentos podem ser eliminadas. A eliminação fica na auditoria.` : ""}
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deleting) act(() => remove(deleting.id), "Despesa eliminada");
          setDeleting(null);
        }}
      />
      <Modal open={!!detail} onClose={() => setDetail(null)} size="lg" title={detail?.description} description={detail ? `${detail.supplierName ?? detail.category} · ${formatDate(detail.date)}` : ""}>
        {detail && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {(
                [
                  ["Fornecedor", detail.supplierName ?? "—"],
                  ["NIF", detail.nif ?? "—"],
                  ["Factura", detail.invoiceRef ?? "—"],
                  ["Data da factura", detail.invoiceDate ? formatDate(detail.invoiceDate) : "—"],
                  ["Vencimento", detail.dueDate ? formatDate(detail.dueDate) : "—"],
                  ["Data do pagamento", detail.paymentDate ? formatDate(detail.paymentDate) : "—"],
                  ["Categoria", detail.category],
                  ["Rubrica orçamental", lineName(detail.budgetLineId) ?? "por classificar"],
                  ["Centro de custo", detail.costCenter ?? "—"],
                  ["Valor", formatKz(detail.amount)],
                  ["IVA", formatKz(detail.vat ?? 0)],
                  ["Retenção", formatKz(detail.withholding ?? 0)],
                  ["Líquido", formatKz(total(detail))],
                  ["Pago", formatKz(detail.paidAmount ?? (detail.status ? 0 : total(detail)))],
                  ["Estado", statusLabel(statusOf(detail))],
                  ["Registada por", detail.createdBy ?? "—"],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-graphite-500">{k}</dt>
                  <dd className="text-navy-900">{v}</dd>
                </div>
              ))}
            </dl>
            {detail.voidReason && <p className="rounded-xl bg-graphite-50 p-3">Anulada: {detail.voidReason}</p>}
            {detail.notes && <p className="rounded-xl bg-amber-50 p-3 text-amber-900">{detail.notes}</p>}
            {(detail.attachments ?? []).length > 0 && (
              <p>
                Anexos:{" "}
                {detail.attachments!.map((a, i) => (
                  <a key={i} href={fileSrc(a)} target="_blank" rel="noreferrer" className="mr-2 text-navy-700 underline">
                    {a.name}
                  </a>
                ))}
              </p>
            )}
            {detail.source && (
              <details className="rounded-xl bg-graphite-50 p-3 text-xs">
                <summary className="cursor-pointer">Origem: {detail.source.file} (linha {detail.source.row}) — valores originais</summary>
                <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(detail.source.raw, null, 2)}</pre>
              </details>
            )}
            <div>
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold tracking-wider text-graphite-500 uppercase">
                <History className="h-3.5 w-3.5" /> Histórico
              </p>
              <ol className="space-y-1 text-xs text-graphite-600">
                {(detail.history ?? []).map((h, i) => (
                  <li key={i}>
                    {formatDateTime(h.at)} · <strong>{h.by}</strong> — {h.text}
                  </li>
                ))}
                {!(detail.history ?? []).length && <li>Registo anterior ao histórico detalhado.</li>}
              </ol>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function statusLabel(s: Status) {
  return { pendente: "Pendente", aprovada: "Aprovada", paga: "Paga", parcialmente_paga: "Parcialmente paga", anulada: "Anulada", legado: "Paga (registo anterior)" }[s];
}

function Reports({ rows, lineName }: { rows: Expense[]; lineName: (id?: string) => string | undefined }) {
  const [by, setBy] = useState<"mes" | "trimestre" | "ano" | "fornecedor" | "categoria" | "rubrica">("mes");
  const key = (e: Expense) =>
    by === "mes" ? e.date.slice(0, 7) : by === "trimestre" ? e.period : by === "ano" ? e.date.slice(0, 4) : by === "fornecedor" ? e.supplierName ?? "Sem fornecedor" : by === "categoria" ? e.category : lineName(e.budgetLineId) ?? "Por classificar";
  const groups = Array.from(
    rows.reduce((m, e) => {
      const k = key(e);
      const g = m.get(k) ?? { k, n: 0, valor: 0, iva: 0, ret: 0, liq: 0 };
      g.n++;
      g.valor += e.amount;
      g.iva += e.vat ?? 0;
      g.ret += e.withholding ?? 0;
      g.liq += e.netAmount ?? e.amount;
      m.set(k, g);
      return m;
    }, new Map<string, { k: string; n: number; valor: number; iva: number; ret: number; liq: number }>()),
  )
    .map(([, g]) => g)
    .sort((a, b) => (["mes", "trimestre", "ano"].includes(by) ? a.k.localeCompare(b.k) : b.valor - a.valor));
  const chart = groups.slice(0, 15).map((g) => ({ label: by === "trimestre" ? formatQuarter(g.k, "short") : g.k, value: Math.round(g.valor) }));
  return (
    <div className="space-y-6">
      <Tabs
        className="w-fit max-w-full"
        value={by}
        onChange={setBy}
        tabs={[
          { id: "mes", label: "Por mês" },
          { id: "trimestre", label: "Por trimestre" },
          { id: "ano", label: "Por ano" },
          { id: "fornecedor", label: "Por fornecedor" },
          { id: "categoria", label: "Por categoria" },
          { id: "rubrica", label: "Por rubrica" },
        ]}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Despesas (valor)" />
          <CardBody>{["mes", "trimestre", "ano"].includes(by) ? <GroupedBars data={chart.map((c) => ({ label: c.label, valor: c.value }))} series={[{ key: "valor", label: "Valor" }]} /> : <HBars currency data={chart} height={Math.max(220, chart.length * 26)} />}</CardBody>
        </Card>
        <Card>
          <CardHeader title="Distribuição" />
          <CardBody>
            <Donut data={chart.slice(0, 8).map((c) => ({ key: c.label, label: c.label, value: c.value }))} />
          </CardBody>
        </Card>
      </div>
      <Card>
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-graphite-100 bg-graphite-50/70 text-[11px] tracking-wider text-graphite-500 uppercase">
                {["Grupo", "N.º", "Valor", "IVA", "Retenção", "Líquido"].map((h) => (
                  <th key={h} className={`px-4 py-2.5 ${h === "Grupo" ? "text-left" : "text-right"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-100">
              {groups.map((g) => (
                <tr key={g.k}>
                  <td className="px-4 py-2 font-medium text-navy-900">{by === "trimestre" ? formatQuarter(g.k) : g.k}</td>
                  <td className="px-4 py-2 text-right">{g.n}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatKz(g.valor)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatKz(g.iva)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatKz(g.ret)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatKz(g.liq)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ExpenseForm({ expense, lines, onClose }: { expense: Expense | null; lines: BudgetLineOpt[]; onClose: () => void }) {
  const suppliers = useDemoStore((s) => s.suppliers);
  const add = useDemoStore((s) => s.addExpense);
  const update = useDemoStore((s) => s.updateExpense);
  const saveSupplier = useDemoStore((s) => s.saveSupplier);
  const [f, setF] = useState({
    date: expense?.date ?? todayISO(),
    description: expense?.description ?? "",
    category: (expense?.category ?? "Manutenção") as ExpenseCategory,
    supplierId: expense?.supplierId ?? "",
    newSupplier: "",
    nif: expense?.nif ?? "",
    invoiceRef: expense?.invoiceRef ?? "",
    invoiceDate: expense?.invoiceDate ?? "",
    dueDate: expense?.dueDate ?? "",
    amount: expense ? String(expense.amount) : "",
    vat: expense?.vat ? String(expense.vat) : "",
    withholding: expense?.withholding ? String(expense.withholding) : "",
    budgetLineId: expense?.budgetLineId ?? "",
    costCenter: expense?.costCenter ?? "",
    notes: expense?.notes ?? "",
    note: "",
  });
  const [attachment, setAttachment] = useState<PaymentProof | null>(null);
  const net = (Number(f.amount) || 0) + (Number(f.vat) || 0) - (Number(f.withholding) || 0);
  const save = () => {
    try {
      let supplierId = f.supplierId || undefined;
      let supplierName = suppliers.find((s) => s.id === supplierId)?.name;
      if (!supplierId && f.newSupplier.trim()) {
        const s = saveSupplier({ id: "", name: f.newSupplier.trim(), nif: f.nif || undefined, active: true, createdAt: "" });
        supplierId = s.id;
        supplierName = s.name;
      }
      const data = {
        date: f.date,
        description: f.description.trim(),
        category: f.category,
        amount: Number(f.amount),
        supplierId,
        supplierName,
        nif: f.nif.trim() || undefined,
        invoiceRef: f.invoiceRef.trim() || undefined,
        invoiceDate: f.invoiceDate || undefined,
        dueDate: f.dueDate || undefined,
        vat: Number(f.vat) || 0,
        withholding: Number(f.withholding) || 0,
        budgetLineId: f.budgetLineId || undefined,
        costCenter: f.costCenter.trim() || undefined,
        notes: f.notes.trim() || undefined,
      };
      if (expense) {
        update(expense.id, { ...data, ...(attachment ? { attachments: [...(expense.attachments ?? []), attachment] } : {}) }, f.note || undefined);
        toast.success("Despesa corrigida (alterações no histórico).");
      } else {
        add({ ...data, attachments: attachment ? [attachment] : undefined, status: "pendente" });
        toast.success("Despesa registada (pendente de aprovação).");
      }
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={expense ? "Corrigir despesa" : "Nova despesa"}
      description="Obrigatórios: data, descrição, categoria e valor. Os restantes campos são facultativos."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save}>Guardar</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3" data-testid="expense-form">
        <Field label="Data" required>
          <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Descrição" required className="sm:col-span-2">
          <Input name="description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <Field label="Fornecedor" hint="Opcional">
          <Select value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: e.target.value, nif: suppliers.find((s) => s.id === e.target.value)?.nif ?? f.nif })} aria-label="Fornecedor">
            <option value="">— novo ou sem fornecedor —</option>
            {suppliers.filter((s) => s.active).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        {!f.supplierId && (
          <Field label="Novo fornecedor" hint="Opcional">
            <Input value={f.newSupplier} onChange={(e) => setF({ ...f, newSupplier: e.target.value })} />
          </Field>
        )}
        <Field label="NIF" hint="Opcional">
          <Input value={f.nif} onChange={(e) => setF({ ...f, nif: e.target.value })} />
        </Field>
        <Field label="Ref. da factura" hint="Opcional">
          <Input value={f.invoiceRef} onChange={(e) => setF({ ...f, invoiceRef: e.target.value })} />
        </Field>
        <Field label="Data da factura" hint="Opcional">
          <Input type="date" value={f.invoiceDate} onChange={(e) => setF({ ...f, invoiceDate: e.target.value })} />
        </Field>
        <Field label="Vencimento" hint="Opcional">
          <Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
        </Field>
        <Field label="Categoria" required>
          <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as ExpenseCategory })} aria-label="Categoria da despesa">
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Valor (Kz)" required>
          <Input name="amount" type="number" min={0} step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </Field>
        <Field label="IVA (Kz)" hint="Opcional">
          <Input type="number" min={0} step="0.01" value={f.vat} onChange={(e) => setF({ ...f, vat: e.target.value })} />
        </Field>
        <Field label="Retenção (Kz)" hint="Opcional">
          <Input type="number" min={0} step="0.01" value={f.withholding} onChange={(e) => setF({ ...f, withholding: e.target.value })} />
        </Field>
        <Field label="Rubrica orçamental" hint="Opcional" className="sm:col-span-2">
          <Select value={f.budgetLineId} onChange={(e) => setF({ ...f, budgetLineId: e.target.value })} aria-label="Rubrica">
            <option value="">Por classificar</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Centro de custo" hint="Opcional">
          <Input value={f.costCenter} onChange={(e) => setF({ ...f, costCenter: e.target.value })} placeholder="Ex.: Bloco 03, Piscina" />
        </Field>
        <p className="self-end rounded-xl bg-graphite-50 px-3 py-2 text-sm sm:col-span-3">
          Líquido a pagar: <strong>{formatKz(net)}</strong> (valor + IVA − retenção)
        </p>
        <Field label="Observações" hint="Opcional" className="sm:col-span-2">
          <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        <div>
          <p className="mb-1.5 text-xs font-medium text-graphite-700">Anexo (factura) — opcional</p>
          <ProofInput value={attachment} onChange={setAttachment} label="Carregar factura" />
        </div>
        {expense && (
          <Field label="Motivo da correcção" hint="Fica no histórico" className="sm:col-span-3">
            <Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

function PayModal({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const pay = useDemoStore((s) => s.payExpense);
  const due = Math.round((total(expense) - (expense.paidAmount ?? 0)) * 100) / 100;
  const [f, setF] = useState({ date: todayISO(), amount: String(due), method: "transferencia" as PaymentMethod, reference: "" });
  return (
    <Modal
      open
      onClose={onClose}
      title="Registar pagamento da despesa"
      description={`${expense.description} · em falta ${formatKz(due)}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              try {
                pay(expense.id, { date: f.date, amount: Number(f.amount), method: f.method, reference: f.reference || undefined });
                toast.success("Pagamento registado.");
                onClose();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Erro");
              }
            }}
          >
            Registar
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Data">
          <Input type="date" value={f.date} max={todayISO()} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Valor (Kz)" hint="Pode ser parcial">
          <Input type="number" min={1} max={due} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </Field>
        <Field label="Método">
          <Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as PaymentMethod })}>
            {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Referência" hint="Opcional">
          <Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function VoidModal({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const voidExpense = useDemoStore((s) => s.voidExpense);
  const [reason, setReason] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title="Anular despesa"
      description={`${expense.description} — o registo é mantido com o estado Anulada (não é apagado).`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              try {
                voidExpense(expense.id, reason);
                toast.success("Despesa anulada.");
                onClose();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Erro");
              }
            }}
          >
            Anular
          </Button>
        </>
      }
    >
      <Field label="Motivo" required>
        <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Modal>
  );
}
