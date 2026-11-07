"use client";

import { CheckCircle2, Download, HandCoins, Info } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Payment, PaymentMethod, PaymentProof } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { useSession } from "@/hooks/use-session";
import { can } from "@/config/permissions";
import { BLOCKS } from "@/data/management";
import { roleLabels } from "@/data/users";
import { formKey } from "@/lib/api-client";
import { formatKz, formatQuarter, todayISO } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProofInput } from "@/components/app/widgets/proof-input";
import { METHOD_LABELS } from "@/components/app/widgets/review-payment-modal";

export default function PagamentoPresencialPage() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}

function Form() {
  const params = useSearchParams();
  const session = useSession();
  const apartments = useDemoStore((s) => s.apartments);
  const residents = useDemoStore((s) => s.residents);
  const quotas = useDemoStore((s) => s.quotas);
  const payments = useDemoStore((s) => s.payments);
  const allowPartial = useDemoStore((s) => s.settings.allowPartial);
  const register = useDemoStore((s) => s.registerPayment);
  const canValidate = can(session?.role, "payments.review");

  const initialApt = apartments.find((a) => a.id === params.get("apt"));
  const [block, setBlock] = useState(initialApt?.block ?? "01");
  const [aptId, setAptId] = useState(initialApt?.id ?? "");
  const [quotaId, setQuotaId] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayISO());
  const [method, setMethod] = useState<PaymentMethod>("numerario");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<PaymentProof | null>(null);
  const [note, setNote] = useState("");
  const [validate, setValidate] = useState(true);
  const [key, setKey] = useState(formKey);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Payment | null>(null);

  const apts = apartments.filter((a) => a.block === block && a.active).sort((a, b) => a.number.localeCompare(b.number));
  const apt = apartments.find((a) => a.id === aptId);
  const resident = residents.find((r) => r.id === apt?.residentId);
  const open = useMemo(() => quotas.filter((q) => q.apartmentId === aptId && q.status !== "pago").sort((a, b) => a.period.localeCompare(b.period)), [quotas, aptId]);
  const quota = quotas.find((q) => q.id === quotaId);
  const remaining = quota ? Math.round((quota.amount - quota.paidAmount) * 100) / 100 : 0;
  const pendingProof = (qid: string) => payments.some((p) => p.quotaId === qid && p.status === "em_analise");

  const reset = () => {
    setQuotaId("");
    setAmount("");
    setReference("");
    setProof(null);
    setNote("");
    setDone(null);
    setKey(formKey());
  };

  const submit = () => {
    if (busy) return;
    if (!apt) return toast.error("Seleccione a fracção.");
    if (!quota) return toast.error("Seleccione o trimestre / quota.");
    const value = amount ? Number(amount) : remaining;
    if (!(value > 0) || value > remaining) return toast.error(`Indique um valor entre 1 e ${formatKz(remaining)}.`);
    setBusy(true);
    try {
      const p = register({ quotaId: quota.id, amount: value, method, reference, paidAt, note: note || undefined, proof: proof ?? undefined, validate: canValidate && validate, clientKey: key });
      setDone(p);
      toast.success(p.status === "aprovado" ? `Pagamento registado e validado — recibo ${p.receiptNumber}` : "Pagamento registado — em validação", { description: proof ? "Comprovativo associado à fracção, à quota e ao morador." : "Sem comprovativo documental." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registar.");
    } finally {
      // evita cliques repetidos enquanto o pedido é enviado (o servidor recusa também a mesma chave)
      setTimeout(() => setBusy(false), 800);
    }
  };

  const receipt = (p: Payment) =>
    import("@/lib/finance-docs").then((m) =>
      m.downloadReceipt({
        receiptNumber: p.receiptNumber!,
        payer: resident?.name ?? apt?.ownerName ?? "—",
        apartment: apt ? `Bloco ${apt.block} · ${apt.number}` : "—",
        typology: quota?.typology,
        description: quota?.description ?? "Quota do condomínio",
        period: quota ? formatQuarter(quota.period) : undefined,
        amount: p.validatedAmount ?? p.amount,
        method: METHOD_LABELS[p.method],
        reference: p.reference,
        paidAt: p.paidAt,
        validatedBy: p.reviewedBy ?? session?.name ?? "—",
        validatedRole: session ? roleLabels[session.role] : undefined,
        validatedAt: p.reviewedAt ?? p.submittedAt,
      }),
    );

  if (done)
    return (
      <>
        <PageHeader eyebrow="Gestão Financeira" title="Registar pagamento de morador" />
        <Card className="max-w-2xl" data-testid="presencial-result">
          <CardBody className="space-y-4 text-sm">
            <p className="flex items-center gap-2 text-lg font-semibold text-navy-900">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" /> Pagamento registado
            </p>
            <dl className="grid grid-cols-2 gap-2">
              <dt className="text-graphite-500">Fracção</dt>
              <dd>{apt ? `${apt.block}-${apt.number}` : "—"}</dd>
              <dt className="text-graphite-500">Quota</dt>
              <dd>{quota ? formatQuarter(quota.period) : "—"}</dd>
              <dt className="text-graphite-500">Valor</dt>
              <dd className="font-semibold">{formatKz(done.amount)}</dd>
              <dt className="text-graphite-500">Estado</dt>
              <dd>
                <StatusBadge status={done.status} />
              </dd>
              <dt className="text-graphite-500">Comprovativo</dt>
              <dd>{done.proof ? done.proof.name : <span className="text-amber-700">Sem comprovativo documental</span>}</dd>
              {done.receiptNumber && (
                <>
                  <dt className="text-graphite-500">Recibo</dt>
                  <dd>{done.receiptNumber}</dd>
                </>
              )}
            </dl>
            <div className="flex flex-wrap gap-2">
              {done.status === "aprovado" && done.receiptNumber && (
                <Button onClick={() => void receipt(done)}>
                  <Download className="h-4 w-4" /> Recibo PDF
                </Button>
              )}
              <Button variant="outline" onClick={reset}>
                Registar outro pagamento
              </Button>
              {apt && (
                <Link href={`/painel/fraccoes?id=${apt.id}`} className={buttonClass("ghost")}>
                  Ver ficha da fracção
                </Link>
              )}
            </div>
          </CardBody>
        </Card>
      </>
    );

  return (
    <>
      <PageHeader eyebrow="Gestão Financeira" title="Registar pagamento de morador" description="Pagamentos efectuados presencialmente, por transferência ou outros meios, registados pela gestão em nome do morador. O comprovativo é facultativo." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Card>
          <CardBody className="grid gap-4 sm:grid-cols-2" data-testid="presencial-form">
            <Field label="Bloco">
              <Select value={block} onChange={(e) => (setBlock(e.target.value), setAptId(""), setQuotaId(""))} aria-label="Bloco">
                {BLOCKS.map((b) => (
                  <option key={b} value={b}>
                    Bloco {b}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fracção" required>
              <Select value={aptId} onChange={(e) => (setAptId(e.target.value), setQuotaId(""))} aria-label="Fracção">
                <option value="">Seleccione…</option>
                {apts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.block}-{a.number} · {a.typology}
                  </option>
                ))}
              </Select>
            </Field>
            {apt && (
              <p className="rounded-xl bg-graphite-50 px-4 py-3 text-sm sm:col-span-2">
                Morador: <strong>{resident?.name ?? "sem morador registado"}</strong> · Proprietário: {apt.ownerName || "—"} ·{" "}
                <Link href={`/painel/fraccoes?id=${apt.id}`} className="text-navy-700 underline">
                  ficha da fracção
                </Link>
              </p>
            )}
            <Field label="Trimestre / quota" required className="sm:col-span-2" hint={aptId && !open.length ? "Esta fracção não tem quotas em aberto." : undefined}>
              <Select value={quotaId} onChange={(e) => (setQuotaId(e.target.value), setAmount(""))} aria-label="Quota">
                <option value="">Seleccione…</option>
                {open.map((q) => (
                  <option key={q.id} value={q.id} disabled={pendingProof(q.id)}>
                    {formatQuarter(q.period)} · em dívida {formatKz(q.amount - q.paidAmount)}
                    {pendingProof(q.id) ? " (comprovativo em validação)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Valor pago (Kz)" required hint={quota ? `Em dívida: ${formatKz(remaining)}${allowPartial ? " · pagamento parcial permitido" : ""}` : undefined}>
              <Input name="amount" type="number" min={1} max={remaining || undefined} step="0.01" value={amount} placeholder={remaining ? String(remaining) : ""} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Data do pagamento" required>
              <Input name="paidAt" type="date" max={todayISO()} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </Field>
            <Field label="Método de pagamento">
              <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} aria-label="Método">
                {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Referência bancária" hint="Opcional">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-xs font-medium text-graphite-700">Comprovativo (PDF, JPG ou PNG) — facultativo</p>
              <ProofInput value={proof} onChange={setProof} label="Carregar comprovativo em nome do morador (opcional)" />
              {!proof && <p className="mt-1.5 text-xs text-amber-700">Sem comprovativo: o pagamento fica registado com a indicação “sem comprovativo documental”.</p>}
            </div>
            <Field label="Observações" hint="Opcional" className="sm:col-span-2">
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            {canValidate && (
              <label className="flex items-start gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={validate} onChange={(e) => setValidate(e.target.checked)} className="mt-1" name="validate" />
                Validar já o pagamento e emitir recibo (desmarque para o deixar Em Validação para outro responsável).
              </label>
            )}
            <div className="sm:col-span-2">
              <Button onClick={submit} disabled={busy} loading={busy}>
                <HandCoins className="h-4 w-4" /> Guardar pagamento
              </Button>
            </div>
          </CardBody>
        </Card>
        <Card className="h-fit">
          <CardHeader title="Regras" action={<Info className="h-4 w-4 text-graphite-400" />} />
          <CardBody className="space-y-2 text-xs text-graphite-600">
            <p>• O pagamento fica de imediato na conta corrente da fracção e no painel financeiro.</p>
            <p>• Não é possível pagar acima do valor em dívida da quota; pagamentos parciais ficam “Parcialmente pago”.</p>
            <p>• O comprovativo carregado fica associado à fracção, à quota e ao morador (que o pode consultar).</p>
            <p>• Cliques repetidos ou reenvios não duplicam o pagamento.</p>
            <p>• O registo, quem o fez e a validação ficam na auditoria.</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
