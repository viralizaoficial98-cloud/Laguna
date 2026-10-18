"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCircle2, FileUp, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { PaymentMethod, PaymentProof, Quota } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { cn, formatBytes, formatDate, formatKz, formatPeriod } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { METHOD_LABELS, ProofPreview } from "./review-payment-modal";

const STEPS = ["Quota", "Pagamento", "Comprovativo", "Confirmação"];
const MAX_SIZE = 5 * 1024 * 1024;

export function PayQuotaModal({ quota, residentId, onClose }: { quota: Quota | null; residentId?: string; onClose: () => void }) {
  const submitPayment = useDemoStore((s) => s.submitPayment);
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("transferencia");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState("2026-10-18");
  const [proof, setProof] = useState<PaymentProof | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep(0);
    setReference("");
    setProof(null);
    setError(null);
    onClose();
  };

  const readFile = (file: File) => {
    if (!["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(file.type)) {
      setError("Formato não suportado. Utilize PDF, JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("O ficheiro excede 5 MB.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setProof({ name: file.name, type: file.type, size: file.size, dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const next = () => {
    if (step === 1 && reference.trim().length < 4) {
      setError("Indique a referência da transacção (mín. 4 caracteres).");
      return;
    }
    if (step === 2 && !proof) {
      setError("Seleccione o comprovativo de pagamento.");
      return;
    }
    setError(null);
    if (step === 2 && quota) {
      submitPayment({ quotaId: quota.id, apartmentId: quota.apartmentId, residentId, amount: quota.amount, method, reference: reference.trim(), paidAt: `${paidAt}T12:00:00`, proof: proof ?? undefined });
      toast.success("Comprovativo enviado", { description: "O pagamento ficou em análise (demonstração)." });
    }
    setStep((s) => s + 1);
  };

  return (
    <Modal
      open={!!quota}
      onClose={reset}
      size="lg"
      title="Registar pagamento"
      description={quota ? `${quota.description} · ${formatPeriod(quota.period, true)}` : ""}
      footer={
        step < 3 ? (
          <>
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                Voltar
              </Button>
            )}
            <Button onClick={next}>{step === 2 ? "Enviar comprovativo" : "Continuar"}</Button>
          </>
        ) : (
          <Button onClick={reset}>Concluir</Button>
        )
      }
    >
      {/* passos */}
      <ol className="mb-6 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors", i < step ? "bg-emerald-600 text-white" : i === step ? "bg-navy-900 text-white" : "bg-graphite-100 text-graphite-500")}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn("hidden text-xs sm:block", i === step ? "font-medium text-navy-900" : "text-graphite-500")}>{s}</span>
            {i < STEPS.length - 1 && <span className={cn("h-px flex-1", i < step ? "bg-emerald-300" : "bg-graphite-200")} />}
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
          {quota && step === 0 && (
            <div className="rounded-2xl border border-graphite-100 bg-gradient-to-br from-navy-900 to-navy-800 p-6 text-white">
              <p className="text-xs tracking-widest text-gold-300 uppercase">Valor a pagar</p>
              <p className="mt-2 text-4xl font-semibold tabular-nums">{formatKz(quota.amount)}</p>
              <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-navy-200">Período</p>
                  <p className="font-medium">{formatPeriod(quota.period, true)}</p>
                </div>
                <div>
                  <p className="text-navy-200">Vencimento</p>
                  <p className="font-medium">{formatDate(quota.dueDate)}</p>
                </div>
              </div>
              <p className="mt-5 rounded-xl bg-white/10 p-3 text-xs text-navy-100">Os dados bancários oficiais do condomínio serão apresentados aqui na versão final.</p>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Método de pagamento" className="sm:col-span-2">
                <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                    <option key={m} value={m}>
                      {METHOD_LABELS[m]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Referência da transacção" required>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex.: TRF-123456" invalid={!!error} />
              </Field>
              <Field label="Data do pagamento" required>
                <Input type="date" value={paidAt} max="2026-12-31" onChange={(e) => setPaidAt(e.target.value)} />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div>
              <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
              {!proof ? (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDrag(true);
                  }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDrag(false);
                    if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
                  }}
                  className={cn("flex w-full flex-col items-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition", drag ? "border-gold-400 bg-gold-50" : "border-graphite-200 hover:border-navy-300 hover:bg-navy-50/40")}
                >
                  <UploadCloud className="h-10 w-10 text-navy-500" />
                  <p className="mt-3 font-medium text-navy-900">Arraste o comprovativo ou clique para seleccionar</p>
                  <p className="mt-1 text-xs text-graphite-500">PDF, JPG, PNG ou WEBP · máx. 5 MB</p>
                </button>
              ) : (
                <div className="space-y-3">
                  <ProofPreview payment={{ proof }} />
                  <div className="flex items-center justify-between rounded-xl bg-graphite-50 px-4 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <FileUp className="h-4 w-4 shrink-0 text-navy-600" />
                      <span className="truncate">{proof.name}</span>
                      <span className="shrink-0 text-xs text-graphite-500">{formatBytes(proof.size)}</span>
                    </span>
                    <button onClick={() => setProof(null)} className="rounded-lg p-1.5 text-graphite-400 hover:bg-red-50 hover:text-red-600" aria-label="Remover ficheiro">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
              <DemoDataNote className="mt-4">Pré-visualização local — o ficheiro não é enviado para nenhum servidor.</DemoDataNote>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center py-6 text-center">
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }} className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 className="h-9 w-9 text-emerald-600" />
              </motion.span>
              <p className="mt-4 font-display text-3xl text-navy-900">Comprovativo enviado</p>
              <p className="mt-2 max-w-sm text-sm text-graphite-500">O seu pagamento está agora <strong>em análise</strong>. Será notificado(a) quando o Financeiro aprovar ou rejeitar o comprovativo.</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
    </Modal>
  );
}
