"use client";

import { useMemo } from "react";
import { useDemoStore } from "@/store/demo-store";
import { formatQuarter, parseQuarter, quarterOf, todayISO } from "@/lib/utils";
import { BLOCKS } from "@/data/management";
import { EXPENSE_CATEGORIES } from "@/data/operations";
import type { Expense, Quota } from "@/types";

/** Trimestre corrente (ex.: "2026-T4"). */
export const CURRENT_PERIOD = quarterOf(todayISO());

export interface FinanceFilter {
  year?: number;
  quarter?: number;
  block?: string;
}

function inPeriod(period: string, f: FinanceFilter) {
  const { year, quarter } = parseQuarter(period);
  return (!f.year || year === f.year) && (!f.quarter || quarter === f.quarter);
}

/**
 * Indicadores financeiros TRIMESTRAIS derivados do estado (quotas, pagamentos, despesas
 * e custos de manutenção concluída). Actualizam em tempo real. Valores de demonstração.
 */
export function useFinance(filter: FinanceFilter = {}) {
  const quotas = useDemoStore((s) => s.quotas);
  const payments = useDemoStore((s) => s.payments);
  const apartments = useDemoStore((s) => s.apartments);
  const fixedExpenses = useDemoStore((s) => s.expenses);
  const opsTasks = useDemoStore((s) => s.opsTasks);
  const { year, quarter, block } = filter;

  return useMemo(() => {
    const f = { year, quarter, block };
    const blockOf = new Map(apartments.map((a) => [a.id, a.block]));
    const sum = (list: Quota[]) => list.reduce((a, q) => a + q.amount, 0);
    const scoped = quotas.filter((q) => inPeriod(q.period, f) && (!block || blockOf.get(q.apartmentId) === block));
    const byStatus = (st: Quota["status"], list = scoped) => list.filter((q) => q.status === st);

    // despesas = contratos + custos efectivos de manutenção concluída (registada pelo Gestor)
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
    const expenses = allExpenses.filter((e) => inPeriod(e.period, f));
    const expensesTotal = expenses.reduce((a, e) => a + e.amount, 0);

    const periods = Array.from(new Set([...quotas.map((q) => q.period), ...allExpenses.map((e) => e.period)]))
      .filter((p) => (!year || parseQuarter(p).year === year) && p <= CURRENT_PERIOD)
      .sort();

    const quarterly = periods.map((period) => {
      const list = quotas.filter((q) => q.period === period && (!block || blockOf.get(q.apartmentId) === block));
      const exp = allExpenses.filter((e) => e.period === period).reduce((a, e) => a + e.amount, 0);
      const prevista = sum(list);
      const recebida = sum(list.filter((q) => q.status === "pago"));
      return {
        period,
        label: formatQuarter(period, "short"),
        prevista,
        recebida,
        // compatibilidade com componentes existentes
        emitido: prevista,
        recebido: recebida,
        emAtraso: sum(list.filter((q) => q.status === "em_atraso")),
        despesas: exp,
        resultado: recebida - exp,
      };
    });

    const expensesByCategory = EXPENSE_CATEGORIES.map((c) => ({ key: c, label: c, value: expenses.filter((e) => e.category === c).reduce((a, e) => a + e.amount, 0) })).filter((x) => x.value > 0);

    const byBlock = BLOCKS.map((b) => {
      const list = quotas.filter((q) => inPeriod(q.period, f) && blockOf.get(q.apartmentId) === b);
      const debt = sum(list.filter((q) => q.status === "em_atraso" || q.status === "pendente"));
      const paid = list.filter((q) => q.status === "pago").length;
      return { block: b, label: b, divida: debt, taxa: list.length ? Math.round((paid / list.length) * 1000) / 10 : 0, total: list.length, pagas: paid };
    });

    const expected = sum(scoped);
    const received = sum(byStatus("pago"));
    const debt = sum(byStatus("em_atraso")) + sum(byStatus("pendente"));

    const statusCounts = (["pago", "em_analise", "pendente", "em_atraso"] as const).map((s) => ({ status: s, count: byStatus(s).length, amount: sum(byStatus(s)) }));
    const current = quarterly.find((m) => m.period === CURRENT_PERIOD);

    return {
      expected,
      received,
      receivedPayments: payments.filter((p) => p.status === "aprovado").reduce((a, p) => a + p.amount, 0),
      debt,
      expensesTotal,
      result: received - expensesTotal,
      collectionRate: expected ? received / expected : 0,
      pending: sum(byStatus("pendente")),
      pendingCount: byStatus("pendente").length,
      overdue: sum(byStatus("em_atraso")),
      overdueCount: byStatus("em_atraso").length,
      analysis: sum(byStatus("em_analise")),
      analysisCount: byStatus("em_analise").length,
      paidCount: byStatus("pago").length,
      quarterly,
      expensesByCategory,
      byBlock,
      statusCounts,
      quarterRevenue: current?.recebida ?? 0,
      quarterExpected: current?.prevista ?? 0,
      years: Array.from(new Set(quotas.map((q) => q.year))).sort(),
    };
  }, [quotas, payments, apartments, fixedExpenses, opsTasks, year, quarter, block]);
}
