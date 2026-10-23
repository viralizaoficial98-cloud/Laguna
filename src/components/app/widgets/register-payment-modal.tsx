"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { PaymentMethod } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { BLOCKS } from "@/data/management";
import { formatKz, formatQuarter, todayISO } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { METHOD_LABELS } from "./review-payment-modal";

/** Registo directo de um pagamento pelo Gestor Financeiro (ex.: numerário ou transferência confirmada no extracto). */
export function RegisterPaymentModal({ open, onClose, quotaId: initialQuota }: { open: boolean; onClose: () => void; quotaId?: string }) {
  const apartments = useDemoStore((s) => s.apartments);
  const quotas = useDemoStore((s) => s.quotas);
  const allowPartial = useDemoStore((s) => s.settings.allowPartial);
  const register = useDemoStore((s) => s.registerPayment);
  const initial = quotas.find((q) => q.id === initialQuota);
  const initialApt = apartments.find((a) => a.id === initial?.apartmentId);
  const [block, setBlock] = useState(initialApt?.block ?? "01");
  const [aptId, setAptId] = useState(initialApt?.id ?? "");
  const [quotaId, setQuotaId] = useState(initialQuota ?? "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("transferencia");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(todayISO());
  const [note, setNote] = useState("");

  const apts = apartments.filter((a) => a.block === block && a.active);
  const open_ = useMemo(() => quotas.filter((q) => q.apartmentId === aptId && q.status !== "pago").sort((a, b) => a.period.localeCompare(b.period)), [quotas, aptId]);
  const quota = quotas.find((q) => q.id === quotaId);
  const remaining = quota ? quota.amount - quota.paidAmount : 0;

  const submit = () => {
    if (!quota) return toast.error("Seleccione a quota.");
    try {
      const p = register({ quotaId: quota.id, amount: amount ? Number(amount) : remaining, method, reference: reference.trim(), paidAt, note: note.trim() || undefined });
      toast.success("Pagamento registado", { description: `Recibo ${p.receiptNumber} emitido · conta corrente actualizada.` });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registar.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Registar pagamento"
      description="Pagamento confirmado pelo Gestor Financeiro — fica aprovado e emite recibo."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit}>Registar e emitir recibo</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bloco">
          <Select
            value={block}
            onChange={(e) => {
              setBlock(e.target.value);
              setAptId("");
              setQuotaId("");
            }}
          >
            {BLOCKS.map((b) => (
              <option key={b} value={b}>
                Bloco {b}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Apartamento">
          <Select
            value={aptId}
            onChange={(e) => {
              setAptId(e.target.value);
              setQuotaId("");
            }}
            aria-label="Apartamento"
          >
            <option value="">Seleccione…</option>
            {apts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.number} · {a.typology}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quota trimestral" className="sm:col-span-2" hint={aptId && !open_.length ? "Esta fracção não tem quotas em aberto." : undefined}>
          <Select value={quotaId} onChange={(e) => setQuotaId(e.target.value)} aria-label="Quota">
            <option value="">Seleccione…</option>
            {open_.map((q) => (
              <option key={q.id} value={q.id} disabled={q.status === "em_analise"}>
                {formatQuarter(q.period)} · {formatKz(q.amount - q.paidAmount)} em dívida{q.status === "em_analise" ? " (comprovativo em validação)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Valor (Kz)" hint={quota ? `Em dívida: ${formatKz(remaining)}${allowPartial ? " · pagamentos parciais autorizados" : ""}` : undefined}>
          <Input type="number" min={1} max={remaining || undefined} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={remaining ? String(remaining) : ""} />
        </Field>
        <Field label="Data do pagamento">
          <Input type="date" value={paidAt} max={todayISO()} onChange={(e) => setPaidAt(e.target.value)} />
        </Field>
        <Field label="Método">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Referência" hint="Opcional">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
