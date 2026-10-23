/**
 * Conta corrente de uma fracção — cálculo PURO (sem estado), usado no extracto,
 * na verificação financeira da desocupação e no bloqueio da declaração de quitação.
 */
import type { Charge, Occupancy, Payment, Quota, Reservation } from "@/types";
import { formatQuarter, quarterOf, todayISO } from "@/lib/utils";

export interface StatementLine {
  id: string;
  date: string;
  origin: "Quota" | "Pagamento" | "Encargo" | "Reserva";
  description: string;
  period?: string;
  debit: number;
  credit: number;
  status: string;
}

export interface OpenItem {
  origin: "Quota vencida" | "Quota parcial" | "Encargo" | "Reserva de salão";
  description: string;
  period?: string;
  amount: number;
  dueDate?: string;
}

export interface AccountSummary {
  lines: (StatementLine & { balance: number })[];
  quotasTotal: number;
  paidTotal: number;
  /** Pagamentos submetidos e ainda não validados. */
  inValidation: number;
  inValidationCount: number;
  /** Quotas vencidas por liquidar (incl. remanescente de parciais). */
  overdue: number;
  /** Quotas ainda não vencidas por pagar. */
  upcoming: number;
  /** Pagamentos aprovados de quotas ainda não vencidas (antecipados). */
  credits: number;
  charges: number;
  reservationsUnpaid: number;
  /** Dívida confirmada = quotas vencidas + encargos confirmados + reservas por liquidar. */
  confirmedDebt: number;
  openItems: OpenItem[];
  /** Pode emitir-se declaração de quitação: sem dívida confirmada nem pagamentos em validação. */
  canIssueClearance: boolean;
  finalBalance: number;
  from?: string;
}

export function computeAccount(input: {
  apartmentId: string;
  quotas: Quota[];
  payments: Payment[];
  charges?: Charge[];
  reservations?: Reservation[];
  occupancy?: Pick<Occupancy, "from" | "residentId">;
  today?: string;
}): AccountSummary {
  const today = input.today ?? todayISO();
  const fromPeriod = input.occupancy ? quarterOf(input.occupancy.from) : undefined;
  const quotas = input.quotas.filter((q) => q.apartmentId === input.apartmentId && (!fromPeriod || q.period >= fromPeriod) && q.period <= quarterOf(today));
  const quotaIds = new Set(quotas.map((q) => q.id));
  const payments = input.payments.filter((p) => p.apartmentId === input.apartmentId && quotaIds.has(p.quotaId));
  const charges = (input.charges ?? []).filter((c) => c.apartmentId === input.apartmentId && (c.status === "confirmado" || c.status === "pago"));
  const reservations = (input.reservations ?? []).filter(
    (r) => r.apartmentId === input.apartmentId && (!input.occupancy || r.residentId === input.occupancy.residentId) && ["pendente_pagamento", "em_validacao", "confirmada"].includes(r.status),
  );

  const lines: StatementLine[] = [];
  const openItems: OpenItem[] = [];
  let overdue = 0;
  let upcoming = 0;
  let credits = 0;

  quotas.forEach((q) => {
    lines.push({ id: q.id, date: q.dueDate, origin: "Quota", description: `Quota ${formatQuarter(q.period)} (${q.typology})`, period: q.period, debit: q.amount, credit: 0, status: q.status });
    const remaining = Math.max(0, q.amount - q.paidAmount);
    if (remaining > 0) {
      if (q.dueDate <= today) {
        overdue += remaining;
        openItems.push({ origin: q.paidAmount > 0 ? "Quota parcial" : "Quota vencida", description: `Quota ${formatQuarter(q.period)}${q.paidAmount > 0 ? " — remanescente" : ""}`, period: q.period, amount: remaining, dueDate: q.dueDate });
      } else upcoming += remaining;
    } else if (q.dueDate > today) credits += q.paidAmount;
  });
  payments
    .filter((p) => p.status === "aprovado")
    .forEach((p) =>
      lines.push({ id: p.id, date: p.paidAt.slice(0, 10), origin: "Pagamento", description: `Pagamento ${p.reference || "(sem referência)"}${p.receiptNumber ? ` · ${p.receiptNumber}` : ""}`, debit: 0, credit: p.validatedAmount ?? p.amount, status: "aprovado" }),
    );
  const inValidationList = payments.filter((p) => p.status === "em_analise");

  let chargesOpen = 0;
  charges.forEach((c) => {
    lines.push({ id: c.id, date: c.date, origin: "Encargo", description: c.description, debit: c.amount, credit: 0, status: c.status });
    if (c.status === "pago") lines.push({ id: `${c.id}_p`, date: c.date, origin: "Pagamento", description: `Liquidação: ${c.description}`, debit: 0, credit: c.amount, status: "aprovado" });
    else {
      chargesOpen += c.amount;
      openItems.push({ origin: "Encargo", description: `${c.description} — ${c.justification}`, amount: c.amount, dueDate: c.date });
    }
  });

  let reservationsUnpaid = 0;
  reservations.forEach((r) => {
    lines.push({ id: r.id, date: r.date, origin: "Reserva", description: `Reserva de salão — ${r.eventName} (${r.date})`, debit: r.fee, credit: 0, status: r.status });
    if (r.status === "confirmada") lines.push({ id: `${r.id}_p`, date: r.payment?.reviewedAt?.slice(0, 10) ?? r.date, origin: "Pagamento", description: `Pagamento da reserva${r.payment?.receiptNumber ? ` · ${r.payment.receiptNumber}` : ""}`, debit: 0, credit: r.fee, status: "aprovado" });
    else {
      reservationsUnpaid += r.fee;
      openItems.push({ origin: "Reserva de salão", description: `${r.eventName} — ${r.status === "em_validacao" ? "pagamento em validação" : "por liquidar"}`, amount: r.fee, dueDate: r.date });
    }
  });

  lines.sort((a, b) => a.date.localeCompare(b.date) || b.debit - a.debit);
  const withBalance = lines.reduce<(StatementLine & { balance: number })[]>((acc, l) => {
    acc.push({ ...l, balance: (acc.at(-1)?.balance ?? 0) + l.debit - l.credit });
    return acc;
  }, []);

  const confirmedDebt = overdue + chargesOpen + reservationsUnpaid;
  const inValidation = inValidationList.reduce((a, p) => a + p.amount, 0);
  return {
    lines: withBalance,
    quotasTotal: quotas.reduce((a, q) => a + q.amount, 0),
    paidTotal: payments.filter((p) => p.status === "aprovado").reduce((a, p) => a + (p.validatedAmount ?? p.amount), 0),
    inValidation,
    inValidationCount: inValidationList.length,
    overdue,
    upcoming,
    credits,
    charges: chargesOpen,
    reservationsUnpaid,
    confirmedDebt,
    openItems,
    canIssueClearance: confirmedDebt === 0 && inValidation === 0,
    finalBalance: withBalance.at(-1)?.balance ?? 0,
    from: input.occupancy?.from,
  };
}

/** Recalcula o estado de uma quota a partir dos pagamentos (fonte única). */
export function quotaStatusFrom(q: Pick<Quota, "amount" | "dueDate">, payments: Pick<Payment, "status" | "amount" | "validatedAmount">[], today = todayISO()): { status: Quota["status"]; paidAmount: number } {
  const paid = payments.filter((p) => p.status === "aprovado").reduce((a, p) => a + (p.validatedAmount ?? p.amount), 0);
  if (paid >= q.amount) return { status: "pago", paidAmount: paid };
  if (payments.some((p) => p.status === "em_analise")) return { status: "em_analise", paidAmount: paid };
  if (paid > 0) return { status: "parcial", paidAmount: paid };
  return { status: q.dueDate < today ? "em_atraso" : "pendente", paidAmount: 0 };
}
