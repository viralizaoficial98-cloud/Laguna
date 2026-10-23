"use client";

import { Check, Download, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Guest, PaymentProof } from "@/types";
import { useDemoStore, aptLabel } from "@/store/demo-store";
import { useSession } from "@/hooks/use-session";
import { can } from "@/config/permissions";
import { formatDate, formatDateTime, formatKz, uid } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProofPreview } from "@/components/app/widgets/review-payment-modal";
import { ProofInput } from "@/components/app/widgets/proof-input";

/** Detalhe da reserva com as acções permitidas ao perfil (pagamento, convidados, validação, cancelamento). */
export function ReservationDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const session = useSession();
  const r = useDemoStore((s) => s.reservations.find((x) => x.id === id));
  const hall = useDemoStore((s) => s.halls.find((h) => h.id === r?.hallId));
  const resident = useDemoStore((s) => s.residents.find((x) => x.id === r?.residentId));
  const apartments = useDemoStore((s) => s.apartments);
  const submitPay = useDemoStore((s) => s.submitReservationPayment);
  const review = useDemoStore((s) => s.reviewReservationPayment);
  const cancel = useDemoStore((s) => s.cancelReservation);
  const saveGuests = useDemoStore((s) => s.updateReservationGuests);
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<PaymentProof | null>(null);
  const [note, setNote] = useState("");
  const [guestName, setGuestName] = useState("");

  const close = () => {
    setReference("");
    setProof(null);
    setNote("");
    setGuestName("");
    onClose();
  };
  if (!r) return <Modal open={false} onClose={close}>{null}</Modal>;

  const own = session?.role === "morador" && session.residentId === r.residentId;
  const validator = can(session?.role, "reservations.validate");
  const active = !["cancelada", "expirada"].includes(r.status);
  const run = (fn: () => void, ok: string) => {
    try {
      fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Operação não permitida.");
    }
  };
  const addGuest = () => {
    if (!guestName.trim()) return;
    const guests: Guest[] = [...r.guests, { id: uid("g"), name: guestName.trim() }];
    run(() => saveGuests(r.id, guests), "Convidado adicionado");
    setGuestName("");
  };

  return (
    <Modal
      open={!!r}
      onClose={close}
      size="lg"
      title={`${r.eventName} · ${hall?.name ?? "Salão"}`}
      description={`${formatDate(r.date, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} · ${r.startTime}–${r.endTime}`}
      footer={
        <>
          {active && (own || validator || session?.role === "administrador") && r.status !== "confirmada" && (
            <Button variant="outline" className="text-red-600" onClick={() => (run(() => cancel(r.id, own ? "Cancelada pelo morador" : "Cancelada pela gestão"), "Reserva cancelada — data libertada"), close())}>
              Cancelar reserva
            </Button>
          )}
          {active && own && r.status === "confirmada" && (
            <Button variant="outline" className="text-red-600" onClick={() => (run(() => cancel(r.id, "Cancelada pelo morador"), "Reserva cancelada — data libertada"), close())}>
              Cancelar reserva
            </Button>
          )}
          {r.status === "confirmada" && r.payment?.receiptNumber && (own || validator || session?.role === "administrador") && (
            <Button
              variant="outline"
              onClick={() =>
                import("@/lib/finance-docs").then((m) =>
                  m.downloadReceipt({
                    receiptNumber: r.payment!.receiptNumber!,
                    payer: resident?.name ?? "—",
                    apartment: aptLabel(apartments, r.apartmentId),
                    description: `Reserva do ${hall?.name ?? "salão"} — ${r.eventName} (${formatDate(r.date)})`,
                    amount: r.fee,
                    reference: r.payment!.reference,
                    paidAt: r.payment!.submittedAt,
                    validatedBy: r.payment!.reviewedBy ?? "—",
                    validatedAt: r.payment!.reviewedAt ?? r.payment!.submittedAt,
                  }),
                )
              }
            >
              <Download className="h-4 w-4" /> Recibo
            </Button>
          )}
          <Button onClick={close}>Fechar</Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <dl className="space-y-2.5 text-sm">
          {[
            ["Estado", <StatusBadge key="s" status={r.status} />],
            ["Morador", resident?.name ?? "—"],
            ["Fracção", aptLabel(apartments, r.apartmentId)],
            ["Tipo de evento", r.eventType],
            ["Convidados previstos", String(r.expectedGuests)],
            ["Valor da reserva", formatKz(r.fee)],
            ...(r.expiresAt && r.status === "pendente_pagamento" ? [["Bloqueio provisório até", formatDateTime(r.expiresAt)]] : []),
            ...(r.payment?.reviewedBy ? [["Pagamento validado/decidido por", `${r.payment.reviewedBy} · ${formatDateTime(r.payment.reviewedAt!)}`]] : []),
            ...(r.payment?.note ? [["Observação", r.payment.note]] : []),
            ...(r.notes ? [["Observações do pedido", r.notes]] : []),
          ].map(([k, v]) => (
            <div key={String(k)} className="flex items-start justify-between gap-4 border-b border-graphite-100 pb-2">
              <dt className="text-graphite-500">{k}</dt>
              <dd className="text-right text-graphite-800">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="space-y-4">
          {r.payment?.proof && (
            <div>
              <p className="mb-2 text-xs font-medium text-graphite-600">Comprovativo · ref. {r.payment.reference || "não indicada"}</p>
              <ProofPreview payment={r.payment} />
            </div>
          )}
          <div>
            <p className="mb-2 text-xs font-medium text-graphite-600">Lista de convidados ({r.guests.length})</p>
            <ul className="max-h-40 space-y-1 overflow-auto text-sm">
              {r.guests.map((g) => (
                <li key={g.id} className="flex items-center justify-between rounded-lg bg-graphite-50 px-3 py-1.5">
                  {g.name}
                  {own && active && (
                    <button onClick={() => run(() => saveGuests(r.id, r.guests.filter((x) => x.id !== g.id)), "Convidado removido")} aria-label={`Remover ${g.name}`} className="text-graphite-400 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
              {!r.guests.length && <li className="text-xs text-graphite-400">Sem convidados registados.</li>}
            </ul>
            {own && active && (
              <div className="mt-2 flex gap-2">
                <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Nome do convidado" onKeyDown={(e) => e.key === "Enter" && addGuest()} />
                <Button size="sm" variant="outline" onClick={addGuest} aria-label="Adicionar convidado">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {own && r.status === "pendente_pagamento" && (
        <div className="mt-6 rounded-2xl border border-gold-200 bg-gold-50/50 p-4">
          <p className="text-sm font-semibold text-navy-900">Pagamento da reserva — {formatKz(r.fee)}</p>
          <p className="mb-3 text-xs text-graphite-600">Envie o comprovativo para validação pelo Gestor Financeiro. A data fica bloqueada provisoriamente até {r.expiresAt ? formatDateTime(r.expiresAt) : "ao prazo definido"}.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Referência" hint="Opcional">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
            <ProofInput value={proof} onChange={setProof} />
          </div>
          <Button
            className="mt-3"
            onClick={() => {
              if (!proof) return toast.error("Seleccione o comprovativo de pagamento.");
              run(() => submitPay(r.id, { reference: reference.trim(), proof }), "Comprovativo enviado — reserva em validação");
            }}
          >
            Enviar comprovativo
          </Button>
        </div>
      )}

      {validator && r.status === "em_validacao" && (
        <div className="mt-6 rounded-2xl border border-graphite-200 p-4">
          <p className="mb-3 text-sm font-semibold text-navy-900">Validação financeira do pagamento</p>
          <Field label="Observação / justificação (obrigatória para rejeitar)">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={() => run(() => review(r.id, "aprovado", note.trim() || undefined), "Pagamento validado — reserva confirmada")}>
              <Check className="h-4 w-4" /> Validar e confirmar
            </Button>
            <Button variant="outline" className="text-red-600" onClick={() => run(() => review(r.id, "rejeitado", note), "Comprovativo rejeitado")}>
              <X className="h-4 w-4" /> Rejeitar
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6">
        <p className="mb-2 text-xs font-medium text-graphite-600">Histórico</p>
        <ol className="space-y-1.5 text-xs text-graphite-600">
          {r.history.map((h) => (
            <li key={h.id}>
              <span className="text-graphite-400">{formatDateTime(h.at)}</span> · <strong className="text-graphite-700">{h.by}</strong> — {h.text}
            </li>
          ))}
        </ol>
      </div>
    </Modal>
  );
}
