"use client";

import { Check, FileText, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Payment } from "@/types";
import { useDemoStore, aptLabel } from "@/store/demo-store";
import { useSession } from "@/hooks/use-session";
import { formatBytes, formatDateTime, formatKz, formatQuarter } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";

export const METHOD_LABELS: Record<Payment["method"], string> = {
  transferencia: "Transferência bancária",
  multicaixa: "Multicaixa Express",
  deposito: "Depósito bancário",
  numerario: "Numerário",
};

export function ReviewPaymentModal({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  const session = useSession();
  const review = useDemoStore((s) => s.reviewPayment);
  const apartments = useDemoStore((s) => s.apartments);
  const quota = useDemoStore((s) => s.quotas.find((q) => q.id === payment?.quotaId));
  const resident = useDemoStore((s) => s.residents.find((r) => r.id === payment?.residentId));
  const [note, setNote] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const close = () => {
    setNote("");
    setRejecting(false);
    onClose();
  };

  if (!payment) return <Modal open={false} onClose={close}>{null}</Modal>;
  const canReview = payment.status === "em_analise";

  const decide = (d: "aprovado" | "rejeitado") => {
    if (d === "rejeitado" && !note.trim()) {
      setRejecting(true);
      toast.error("Indique o motivo da rejeição.");
      return;
    }
    review(payment.id, d, session?.name ?? "Financeiro", note || undefined);
    toast.success(d === "aprovado" ? "Pagamento aprovado" : "Pagamento rejeitado", { description: "Indicadores actualizados (demonstração)." });
    close();
  };

  return (
    <Modal
      open={!!payment}
      onClose={close}
      size="lg"
      title="Comprovativo de pagamento"
      description={`${aptLabel(apartments, payment.apartmentId)} · ${quota ? formatQuarter(quota.period) : ""}`}
      footer={
        canReview ? (
          <>
            <Button variant="outline" onClick={() => decide("rejeitado")} className="text-red-600 hover:border-red-200 hover:bg-red-50">
              <X className="h-4 w-4" /> Rejeitar
            </Button>
            <Button onClick={() => decide("aprovado")} className="bg-emerald-700 hover:bg-emerald-800">
              <Check className="h-4 w-4" /> Aprovar pagamento
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={close}>
            Fechar
          </Button>
        )
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <dl className="space-y-3 text-sm">
          {[
            ["Estado", <StatusBadge key="s" status={payment.status} />],
            ["Valor", <span key="v" className="font-semibold text-navy-900">{formatKz(payment.amount)}</span>],
            ["Morador", resident?.name ?? "—"],
            ["Método", METHOD_LABELS[payment.method]],
            ["Referência", payment.reference || "Não indicada"],
            ["Data do pagamento", formatDateTime(payment.paidAt)],
            ["Submetido em", formatDateTime(payment.submittedAt)],
            ...(payment.reviewedBy ? [["Revisto por", `${payment.reviewedBy}${payment.reviewedAt ? ` · ${formatDateTime(payment.reviewedAt)}` : ""}`]] : []),
            ...(payment.note ? [["Observação", payment.note]] : []),
          ].map(([k, v]) => (
            <div key={String(k)} className="flex items-start justify-between gap-4 border-b border-graphite-100 pb-2.5">
              <dt className="text-graphite-500">{k}</dt>
              <dd className="text-right text-graphite-800">{v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <p className="mb-2 text-xs font-medium text-graphite-600">Comprovativo</p>
          <ProofPreview payment={payment} />
        </div>
      </div>
      {canReview && (
        <Field label="Observação / motivo de rejeição" className="mt-6" error={rejecting && !note.trim() ? "Obrigatório para rejeitar." : undefined}>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: Valor não corresponde à quota." />
        </Field>
      )}
    </Modal>
  );
}

export function ProofPreview({ payment }: { payment: Pick<Payment, "proof"> }) {
  const p = payment.proof;
  if (!p) return <p className="rounded-2xl border border-dashed border-graphite-200 p-6 text-center text-sm text-graphite-400">Sem comprovativo.</p>;
  if (p.dataUrl && p.type.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.dataUrl} alt={p.name} className="max-h-80 w-full rounded-2xl border border-graphite-100 object-contain" />;
  }
  if (p.dataUrl && p.type === "application/pdf") {
    return <iframe src={p.dataUrl} title={p.name} className="h-80 w-full rounded-2xl border border-graphite-100" />;
  }
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-graphite-100 bg-graphite-50 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-navy-700 shadow-soft">
        <FileText className="h-6 w-6" />
      </div>
      <p className="mt-3 text-sm font-medium break-all text-navy-900">{p.name}</p>
      <p className="text-xs text-graphite-500">{formatBytes(p.size)} · ficheiro de demonstração</p>
    </div>
  );
}
