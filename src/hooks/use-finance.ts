"use client";

import { useMemo } from "react";
import { useDemoStore } from "@/store/demo-store";
import { QUOTA_PERIODS } from "@/data/management";
import { shortMonth } from "@/lib/utils";
import type { Quota } from "@/types";

export const CURRENT_PERIOD = "2026-10";

/** Indicadores financeiros derivados do estado demonstrativo (actualizam em tempo real). */
export function useFinance() {
  const quotas = useDemoStore((s) => s.quotas);
  const payments = useDemoStore((s) => s.payments);

  return useMemo(() => {
    const due = quotas.filter((q) => q.period <= CURRENT_PERIOD);
    const sum = (list: Quota[]) => list.reduce((a, q) => a + q.amount, 0);
    const byStatus = (s: Quota["status"], list = due) => list.filter((q) => q.status === s);

    const received = payments.filter((p) => p.status === "aprovado").reduce((a, p) => a + p.amount, 0);
    const pendingList = [...byStatus("pendente"), ...byStatus("rejeitado")];
    const overdueList = byStatus("em_atraso");
    const analysisList = quotas.filter((q) => q.status === "em_analise");
    const upcoming = quotas.filter((q) => q.period > CURRENT_PERIOD && q.status !== "aprovado");

    const monthly = QUOTA_PERIODS.filter((p) => p <= CURRENT_PERIOD).map((period) => {
      const list = quotas.filter((q) => q.period === period);
      return {
        period,
        label: shortMonth(period),
        emitido: sum(list),
        recebido: sum(list.filter((q) => q.status === "aprovado")),
        emAtraso: sum(list.filter((q) => q.status === "em_atraso")),
      };
    });

    const quarters = [
      { label: "T2 2026", periods: ["2026-04", "2026-05", "2026-06"] },
      { label: "T3 2026", periods: ["2026-07", "2026-08", "2026-09"] },
      { label: "T4 2026", periods: ["2026-10", "2026-11", "2026-12"] },
    ].map((q) => {
      const list = quotas.filter((x) => q.periods.includes(x.period));
      return { label: q.label, emitido: sum(list), recebido: sum(list.filter((x) => x.status === "aprovado")) };
    });

    const statusCounts = (["aprovado", "em_analise", "pendente", "em_atraso", "rejeitado"] as const).map((s) => ({
      status: s,
      count: byStatus(s).length,
      amount: sum(byStatus(s)),
    }));

    const currentMonth = monthly.find((m) => m.period === CURRENT_PERIOD);

    return {
      received,
      pending: sum(pendingList),
      pendingCount: pendingList.length,
      overdue: sum(overdueList),
      overdueCount: overdueList.length,
      analysis: sum(analysisList),
      analysisCount: analysisList.length,
      upcoming: sum(upcoming),
      upcomingCount: upcoming.length,
      paidCount: byStatus("aprovado").length,
      monthly,
      quarters,
      statusCounts,
      monthRevenue: currentMonth?.recebido ?? 0,
      monthExpected: currentMonth?.emitido ?? 0,
      collectionRate: due.length ? byStatus("aprovado").length / due.length : 0,
    };
  }, [quotas, payments]);
}
