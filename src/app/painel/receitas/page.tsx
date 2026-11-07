"use client";

import { Ban, PiggyBank, Plus, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { useDemoStore } from "@/store/demo-store";
import { apiJson, formKey } from "@/lib/api-client";
import { downloadXlsx } from "@/lib/excel-export";
import { formatDate, formatKz, todayISO } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { IconBtn } from "@/components/ui/icon-button";

interface Revenue {
  id: string;
  date: string;
  period: string;
  budgetLineId: string | null;
  category: string;
  description: string;
  amount: number;
  reference: string | null;
  status: string;
  createdBy: string;
  voidReason: string | null;
}
interface Line {
  id: string;
  name: string;
  kind: string;
  isGroup: boolean;
  quotaShare: number | null;
}

/** Receitas: quotas recebidas (automático, a partir dos pagamentos validados) e outras receitas registadas pela gestão. */
export default function ReceitasPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, reload } = useApi<{ revenues: Revenue[] }>(`/api/revenues?year=${year}`);
  const { data: budget } = useApi<{ lines: Line[] }>(`/api/budget?year=${year}`);
  const payments = useDemoStore((s) => s.payments);
  const lines = (budget?.lines ?? []).filter((l) => l.kind === "receita" && !l.isGroup && !l.quotaShare);
  const [open, setOpen] = useState(false);
  const [voiding, setVoiding] = useState<Revenue | null>(null);
  const [reason, setReason] = useState("");
  const quotaReceived = useMemo(() => payments.filter((p) => p.status === "aprovado" && p.paidAt.startsWith(String(year))).reduce((a, p) => a + (p.validatedAmount ?? p.amount), 0), [payments, year]);
  const list = data?.revenues ?? [];
  const other = list.filter((r) => r.status === "registada").reduce((a, r) => a + r.amount, 0);
  const lineName = (id: string | null) => lines.find((l) => l.id === id)?.name ?? "—";
  return (
    <>
      <PageHeader
        eyebrow="Gestão Financeira"
        title="Receitas"
        description="As quotas recebidas entram automaticamente (pagamentos validados). Aqui registam-se as outras receitas — antenas, água, recuperação de valores vencidos, outras — associadas às rubricas do orçamento."
        actions={
          <div className="flex gap-2">
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Ano" className="w-28">
              {[year - 1, year, year + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Registar receita
            </Button>
            <Button variant="outline" onClick={() => void downloadXlsx(`laguna-receitas-${year}.xlsx`, [{ name: "Receitas", head: ["Data", "Categoria", "Rubrica", "Descrição", "Referência", "Valor (Kz)", "Estado"], rows: list.map((r) => [r.date, r.category, lineName(r.budgetLineId), r.description, r.reference ?? "", r.amount, r.status]), money: [5] }])}>
              Excel
            </Button>
          </div>
        }
      />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard index={0} highlight label={`Quotas recebidas ${year}`} value={formatKz(quotaReceived)} icon={Wallet} hint="pagamentos validados no sistema" />
        <StatCard index={1} label="Outras receitas registadas" value={formatKz(other)} icon={PiggyBank} tone="gold" hint={`${list.filter((r) => r.status === "registada").length} registos`} />
        <StatCard index={2} label="Total no sistema" value={formatKz(quotaReceived + other)} icon={PiggyBank} tone="success" />
      </div>
      <Card>
        <CardHeader title="Outras receitas" description="Receitas anuladas mantêm-se no registo" />
        <DataTable
          rows={list}
          rowKey={(r) => r.id}
          emptyTitle={data ? "Sem receitas registadas" : "A carregar…"}
          columns={[
            { key: "d", header: "Data", cell: (r) => formatDate(r.date) },
            { key: "desc", header: "Descrição", primary: true, cell: (r) => <span className="font-medium text-navy-900">{r.description}<span className="block text-xs font-normal text-graphite-500">{r.category}{r.reference ? ` · ${r.reference}` : ""}</span></span> },
            { key: "l", header: "Rubrica", hideOnMobile: true, cell: (r) => lineName(r.budgetLineId) },
            { key: "v", header: "Valor", align: "right", cell: (r) => formatKz(r.amount) },
            { key: "s", header: "Estado", cell: (r) => <StatusBadge status={r.status === "anulada" ? "anulada" : "paga"} /> },
            {
              key: "x",
              header: "",
              align: "right",
              cell: (r) =>
                r.status !== "anulada" ? (
                  <IconBtn label="Anular" danger onClick={() => setVoiding(r)}>
                    <Ban className="h-4 w-4" />
                  </IconBtn>
                ) : (
                  <span className="text-[11px] text-graphite-400">{r.voidReason}</span>
                ),
            },
          ]}
        />
      </Card>
      {open && <RevenueForm lines={lines} onClose={() => setOpen(false)} onSaved={reload} />}
      <Modal
        open={!!voiding}
        onClose={() => setVoiding(null)}
        title="Anular receita"
        description={voiding?.description}
        footer={
          <Button
            variant="danger"
            onClick={async () => {
              try {
                await apiJson(`/api/revenues/${voiding!.id}`, { method: "POST", json: { reason } });
                toast.success("Receita anulada.");
                setVoiding(null);
                setReason("");
                reload();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Erro");
              }
            }}
          >
            Anular
          </Button>
        }
      >
        <Field label="Motivo" required>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </>
  );
}

function RevenueForm({ lines, onClose, onSaved }: { lines: Line[]; onClose: () => void; onSaved: () => void }) {
  const [key] = useState(formKey);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ date: todayISO(), budgetLineId: lines[0]?.id ?? "", category: "", description: "", amount: "", reference: "" });
  const save = async () => {
    setBusy(true);
    try {
      const line = lines.find((l) => l.id === f.budgetLineId);
      await apiJson("/api/revenues", { method: "POST", json: { date: f.date, budgetLineId: f.budgetLineId || null, category: f.category || line?.name || "Outras receitas", description: f.description, amount: Number(f.amount), reference: f.reference || null, clientKey: key } });
      toast.success("Receita registada.");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Registar receita"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} loading={busy} disabled={busy}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Data" required>
          <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Rubrica" hint="Opcional">
          <Select value={f.budgetLineId} onChange={(e) => setF({ ...f, budgetLineId: e.target.value })}>
            <option value="">Sem rubrica</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Descrição" required className="sm:col-span-2">
          <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ex.: Renda da antena — Outubro" />
        </Field>
        <Field label="Valor (Kz)" required>
          <Input type="number" min={1} step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </Field>
        <Field label="Referência" hint="Opcional">
          <Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
