"use client";

import { useMemo } from "react";
import { useDemoStore } from "@/store/demo-store";
import { formatQuarter, quarterOf, todayISO } from "@/lib/utils";
import type { Quota } from "@/types";

/** Trimestre corrente (ex.: "2026-T4"). */
export const CURRENT_PERIOD = quarterOf(todayISO());

/** Indicadores financeiros TRIMESTRAIS derivados do estado demonstrativo (actualizam em tempo real). */
export function useFinance() {
  const quotas = useDemoStore((s) => s.quotas);
  const payments = useDemoStore((s) => s.payments);

  return useMemo(() => {
    const sum = (list: Quota[]) => list.reduce((a, q) => a + q.amount, 0);
    const byStatus = (st: Quota["status"]) => quotas.filter((q) => q.status === st);

    const received = payments.filter((p) => p.status === "aprovado").reduce((a, p) => a + p.amount, 0);
    const periods = Array.from(new Set(quotas.map((q) => q.period))).sort();

    const quarterly = periods.map((period) => {
      const list = quotas.filter((q) => q.period === period);
      return {
        period,
        label: formatQuarter(period, "short"),
        emitido: sum(list),
        recebido: sum(list.filter((q) => q.status === "pago")),
        emAtraso: sum(list.filter((q) => q.status === "em_atraso")),
      };
    });

    const statusCounts = (["pago", "em_analise", "pendente", "em_atraso"] as const).map((s) => ({
      status: s,
      count: byStatus(s).length,
      amount: sum(byStatus(s)),
    }));

    const current = quarterly.find((m) => m.period === CURRENT_PERIOD);
    const currentList = quotas.filter((q) => q.period === CURRENT_PERIOD);

    return {
      received,
      pending: sum(byStatus("pendente")),
      pendingCount: byStatus("pendente").length,
      overdue: sum(byStatus("em_atraso")),
      overdueCount: byStatus("em_atraso").length,
      analysis: sum(byStatus("em_analise")),
      analysisCount: byStatus("em_analise").length,
      paidCount: byStatus("pago").length,
      quarterly,
      statusCounts,
      quarterRevenue: current?.recebido ?? 0,
      quarterExpected: current?.emitido ?? 0,
      quarterPaidCount: currentList.filter((q) => q.status === "pago").length,
      quarterCount: currentList.length,
      collectionRate: quotas.length ? byStatus("pago").length / quotas.length : 0,
    };
  }, [quotas, payments]);
}
