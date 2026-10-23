"use client";

import { useMemo } from "react";
import { useDemoStore } from "@/store/demo-store";
import { formatQuarter, parseQuarter, quarterOf, todayISO } from "@/lib/utils";
import { BLOCKS, TYPOLOGIES } from "@/data/management";
import { EXPENSE_CATEGORIES } from "@/data/operations";
import type { Expense, Quota, TypologyCode } from "@/types";

/** Trimestre corrente (ex.: "2026-T4"). */
export const CURRENT_PERIOD = quarterOf(todayISO());

export interface FinanceFilter {
  year?: number;
  quarter?: number;
  block?: string;
  typology?: TypologyCode;
}

function inPeriod(period: string, f: FinanceFilter) {
  const { year, quarter } = parseQuarter(period);
  return (!f.year || year === f.year) && (!f.quarter || quarter === f.quarter);
}

const MAINTENANCE_CATEGORIES = ["Manutenção", "Elevadores"];

/**
 * Indicadores financeiros TRIMESTRAIS derivados do estado (quotas, pagamentos validados,
 * reservas, despesas e custos de manutenção concluída). Fonte única para todos os dashboards.
 * - prevista: quotas emitidas · cobrada: valores validados (inclui parciais)
 * - por cobrar (pendente): remanescente no prazo · dívida vencida: remanescente após a data limite
 */
export function useFinance(filter: FinanceFilter = {}) {
  const quotas = useDemoStore((s) => s.quotas);
  const payments = useDemoStore((s) => s.payments);
  const apartments = useDemoStore((s) => s.apartments);
  const fixedExpenses = useDemoStore((s) => s.expenses);
  const opsTasks = useDemoStore((s) => s.opsTasks);
  const reservations = useDemoStore((s) => s.reservations);
  const { year, quarter, block, typology } = filter;

  return useMemo(() => {
    const f = { year, quarter, block };
    const today = todayISO();
    const aptOf = new Map(apartments.map((a) => [a.id, a]));
    const matchApt = (id: string) => (!block || aptOf.get(id)?.block === block) && (!typology || aptOf.get(id)?.typology === typology);
    const remaining = (q: Quota) => Math.max(0, q.amount - q.paidAmount);
    const sum = (list: Quota[]) => list.reduce((a, q) => a + q.amount, 0);
    const paidSum = (list: Quota[]) => list.reduce((a, q) => a + q.paidAmount, 0);
    const remSum = (list: Quota[]) => list.reduce((a, q) => a + remaining(q), 0);
    const isOverdue = (q: Quota) => remaining(q) > 0 && q.dueDate < today && q.status !== "em_analise";
    const isPending = (q: Quota) => remaining(q) > 0 && q.dueDate >= today && q.status !== "em_analise";

    const scoped = quotas.filter((q) => inPeriod(q.period, f) && matchApt(q.apartmentId));
    const byStatus = (st: Quota["status"], list = scoped) => list.filter((q) => q.status === st);

    // despesas = registadas pelo Gestor Financeiro + custos efectivos de manutenção concluída (Gestor Operacional)
    const maintenanceExpenses: Expense[] = opsTasks
      .filter((t) => t.area === "manutencao" && t.status === "concluida" && t.actualCost && t.executedDate)
      .map((t) => ({
        id: `exp_${t.id}`,
        date: t.executedDate!,
        period: quarterOf(t.executedDate!),
        category: t.equipment?.startsWith("Elevador") || t.title.toLowerCase().includes("elevador") ? "Elevadores" : "Manutenção",
        description: t.title,
        amount: t.actualCost!,
      }));
    const allExpenses = [...fixedExpenses, ...maintenanceExpenses];
    // despesas e reservas são do condomínio: não se filtram por bloco/tipologia
    const expenses = allExpenses.filter((e) => inPeriod(e.period, f));
    const expensesTotal = expenses.reduce((a, e) => a + e.amount, 0);
    const maintenanceTotal = expenses.filter((e) => MAINTENANCE_CATEGORIES.includes(e.category)).reduce((a, e) => a + e.amount, 0);

    const confirmedRes = reservations.filter((r) => r.status === "confirmada");
    const resPeriod = (r: (typeof reservations)[number]) => quarterOf((r.payment?.reviewedAt ?? r.date).slice(0, 10));
    const reservationRevenue = confirmedRes.filter((r) => inPeriod(resPeriod(r), f) && matchApt(r.apartmentId)).reduce((a, r) => a + r.fee, 0);

    const periods = Array.from(new Set([...quotas.map((q) => q.period), ...allExpenses.map((e) => e.period)]))
      .filter((p) => (!year || parseQuarter(p).year === year) && p <= CURRENT_PERIOD)
      .sort();

    const base = periods.map((period) => {
      const list = quotas.filter((q) => q.period === period && matchApt(q.apartmentId));
      const exp = allExpenses.filter((e) => e.period === period).reduce((a, e) => a + e.amount, 0);
      const reservas = confirmedRes.filter((r) => resPeriod(r) === period && matchApt(r.apartmentId)).reduce((a, r) => a + r.fee, 0);
      const prevista = sum(list);
      const recebida = paidSum(list);
      return {
        period,
        label: formatQuarter(period, "short"),
        prevista,
        recebida,
        emitido: prevista,
        recebido: recebida,
        emAtraso: remSum(list.filter(isOverdue)),
        reservas,
        despesas: exp,
        resultado: recebida + reservas - exp,
        taxa: prevista ? Math.round((recebida / prevista) * 1000) / 10 : 0,
      };
    });
    // saldo acumulado (recebido + reservas − despesas)
    const quarterly = base.reduce<((typeof base)[number] & { saldo: number })[]>((acc, q) => [...acc, { ...q, saldo: (acc.at(-1)?.saldo ?? 0) + q.resultado }], []);

    const expensesByCategory = EXPENSE_CATEGORIES.map((c) => ({ key: c, label: c, value: expenses.filter((e) => e.category === c).reduce((a, e) => a + e.amount, 0) })).filter((x) => x.value > 0);

    const byBlock = BLOCKS.map((b) => {
      const list = scoped.filter((q) => aptOf.get(q.apartmentId)?.block === b);
      const paid = list.filter((q) => q.status === "pago").length;
      return {
        block: b,
        label: b,
        divida: remSum(list.filter(isOverdue)),
        porCobrar: remSum(list.filter(isPending)),
        prevista: sum(list),
        recebida: paidSum(list),
        taxa: sum(list) ? Math.round((paidSum(list) / sum(list)) * 1000) / 10 : 0,
        total: list.length,
        pagas: paid,
      };
    });

    const byTypology = TYPOLOGIES.map((t) => {
      const list = scoped.filter((q) => q.typology === t);
      return { key: t, label: t, prevista: sum(list), recebida: paidSum(list), divida: remSum(list.filter(isOverdue)), quotas: list.length };
    });

    const expected = sum(scoped);
    const received = paidSum(scoped);
    const overdue = remSum(scoped.filter(isOverdue));
    const pending = remSum(scoped.filter(isPending));
    const analysisQuotas = byStatus("em_analise");

    const scopedIds = new Set(scoped.map((q) => q.id));
    const scopedPayments = payments.filter((p) => scopedIds.has(p.quotaId));
    const approved = scopedPayments.filter((p) => p.status === "aprovado");
    const rejected = scopedPayments.filter((p) => p.status === "rejeitado");
    const inValidation = scopedPayments.filter((p) => p.status === "em_analise");

    const arrearsApts = new Set(scoped.filter(isOverdue).map((q) => q.apartmentId));

    const statusCounts = (["pago", "parcial", "em_analise", "pendente", "em_atraso"] as const).map((s) => ({ status: s, count: byStatus(s).length, amount: s === "pago" ? paidSum(byStatus(s)) : s === "parcial" ? remSum(byStatus(s)) : sum(byStatus(s)) }));
    const current = quarterly.find((m) => m.period === CURRENT_PERIOD);

    return {
      expected,
      received,
      receivedPayments: approved.reduce((a, p) => a + (p.validatedAmount ?? p.amount), 0),
      /** por cobrar (no prazo) + dívida vencida */
      debt: overdue + pending,
      expensesTotal,
      maintenanceTotal,
      operationalExpenses: expensesTotal - maintenanceTotal,
      reservationRevenue,
      result: received + reservationRevenue - expensesTotal,
      collectionRate: expected ? received / expected : 0,
      pending,
      pendingCount: scoped.filter(isPending).length,
      overdue,
      overdueCount: scoped.filter(isOverdue).length,
      partialCount: byStatus("parcial").length,
      analysis: inValidation.reduce((a, p) => a + p.amount, 0),
      analysisCount: analysisQuotas.length,
      approvedCount: approved.length,
      rejectedCount: rejected.length,
      paidCount: byStatus("pago").length,
      arrearsCount: arrearsApts.size,
      quarterly,
      expensesByCategory,
      byBlock,
      byTypology,
      statusCounts,
      quarterRevenue: current?.recebida ?? 0,
      quarterExpected: current?.prevista ?? 0,
      years: Array.from(new Set(quotas.map((q) => q.year))).sort(),
    };
  }, [quotas, payments, apartments, fixedExpenses, opsTasks, reservations, year, quarter, block, typology]);
}
