"use client";

import { useMemo } from "react";
import { useDemoStore } from "@/store/demo-store";
import { BLOCKS } from "@/data/management";
import { OCCURRENCE_CATEGORIES } from "@/data/operations";
import { todayISO } from "@/lib/utils";
import type { OpsArea, OpsTask } from "@/types";

export interface OpsFilter {
  /** Intervalo de datas (inclusivo, YYYY-MM-DD). */
  from?: string;
  to?: string;
  block?: string;
}

/** Actividade atrasada: não concluída após a data prevista/prazo. */
export function isDelayed(t: OpsTask, today = todayISO()) {
  return t.status !== "concluida" && (t.dueDate ?? t.scheduledDate) < today;
}

export function taskState(t: OpsTask, today = todayISO()) {
  return t.status === "concluida" ? "concluida" : isDelayed(t, today) ? "atrasada" : t.status;
}

/**
 * Indicadores operacionais calculados a partir da MESMA fonte de dados (elevadores,
 * ocorrências e actividades) para o dashboard de Nelson Rodrigues e para a supervisão de José Leiria.
 */
export function useOperations(filter: OpsFilter = {}) {
  const elevators = useDemoStore((s) => s.elevators);
  const occurrences = useDemoStore((s) => s.occurrences);
  const tasks = useDemoStore((s) => s.opsTasks);
  const { from, to, block } = filter;

  return useMemo(() => {
    const today = todayISO();
    const inRange = (d?: string) => !!d && (!from || d.slice(0, 10) >= from) && (!to || d.slice(0, 10) <= to);
    const elv = elevators.filter((e) => !block || e.block === block);
    const occ = occurrences.filter((o) => (!block || o.block === block) && (!from && !to ? true : inRange(o.createdAt) || (o.status !== "resolvida" && o.createdAt.slice(0, 10) <= (to ?? today))));
    const tsk = tasks.filter((t) => (!block || !t.block || t.block === block) && (!from && !to ? true : inRange(t.scheduledDate)));
    const dueTasks = tsk.filter((t) => t.scheduledDate <= today);

    const area = (a: OpsArea) => {
      const list = tsk.filter((t) => t.area === a);
      const due = list.filter((t) => t.scheduledDate <= today);
      const done = due.filter((t) => t.status === "concluida");
      const inspected = done.filter((t) => t.inspection);
      return {
        total: list.length,
        due: due.length,
        done: done.length,
        delayed: list.filter((t) => isDelayed(t, today)).length,
        scheduled: list.filter((t) => t.status !== "concluida" && !isDelayed(t, today)).length,
        compliance: due.length ? done.length / due.length : 1,
        conformity: inspected.length ? inspected.filter((t) => t.inspection!.result === "conforme").length / inspected.length : 1,
        inspected: inspected.length,
      };
    };

    const resolved = occ.filter((o) => o.status === "resolvida" && o.resolvedAt);
    const avgResolutionDays = resolved.length
      ? resolved.reduce((a, o) => a + (new Date(o.resolvedAt!).getTime() - new Date(o.createdAt).getTime()) / 86400000, 0) / resolved.length
      : 0;

    const teams = Array.from(new Set(dueTasks.map((t) => t.responsible))).map((team) => {
      const list = dueTasks.filter((t) => t.responsible === team);
      const done = list.filter((t) => t.status === "concluida");
      const onTime = done.filter((t) => (t.executedDate ?? "") <= (t.dueDate ?? t.scheduledDate));
      return { team, total: list.length, done: done.length, onTime: onTime.length, rate: list.length ? Math.round((done.length / list.length) * 1000) / 10 : 0 };
    });

    const maintenance = tsk.filter((t) => t.area === "manutencao");
    const openOcc = occ.filter((o) => o.status !== "resolvida");

    return {
      elevators: {
        total: elv.length,
        operacional: elv.filter((e) => e.status === "operacional").length,
        avariado: elv.filter((e) => e.status === "avariado").length,
        em_manutencao: elv.filter((e) => e.status === "em_manutencao").length,
        fora_servico: elv.filter((e) => e.status === "fora_servico").length,
        list: elv,
      },
      occurrences: {
        list: occ,
        open: openOcc.length,
        urgent: openOcc.filter((o) => o.priority === "urgente").length,
        resolved: occ.filter((o) => o.status === "resolvida").length,
        avgResolutionDays,
        byBlock: BLOCKS.map((b) => ({ label: b, abertas: openOcc.filter((o) => o.block === b).length, resolvidas: occ.filter((o) => o.block === b && o.status === "resolvida").length })),
        byPriority: (["urgente", "alta", "media", "baixa"] as const).map((p) => ({ key: p, value: occ.filter((o) => o.priority === p).length })),
        byCategory: OCCURRENCE_CATEGORIES.map((c) => ({ label: c, value: occ.filter((o) => o.category === c).length })).filter((x) => x.value > 0),
        byStatus: (["aberta", "em_analise", "em_execucao", "resolvida"] as const).map((s) => ({ key: s, value: occ.filter((o) => o.status === s).length })),
      },
      cleaning: area("limpeza"),
      gardening: area("jardinagem"),
      maintenance: {
        ...area("manutencao"),
        preventive: maintenance.filter((t) => t.type === "Preventiva").length,
        corrective: maintenance.filter((t) => t.type === "Correctiva").length,
        preventiveDone: maintenance.filter((t) => t.type === "Preventiva" && t.status === "concluida").length,
        correctiveDone: maintenance.filter((t) => t.type === "Correctiva" && t.status === "concluida").length,
        pending: maintenance.filter((t) => t.status !== "concluida").length,
        estimatedOpen: maintenance.filter((t) => t.status !== "concluida").reduce((a, t) => a + (t.estimatedCost ?? 0), 0),
        actualCost: maintenance.filter((t) => t.status === "concluida").reduce((a, t) => a + (t.actualCost ?? 0), 0),
      },
      tasks: tsk,
      pendingTasks: tsk.filter((t) => t.status !== "concluida" && t.scheduledDate <= today).length,
      delayedTasks: tsk.filter((t) => isDelayed(t, today)),
      planCompliance: dueTasks.length ? dueTasks.filter((t) => t.status === "concluida").length / dueTasks.length : 1,
      teams,
    };
  }, [elevators, occurrences, tasks, from, to, block]);
}
