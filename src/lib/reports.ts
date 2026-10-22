import type { useFinance } from "@/hooks/use-finance";
import type { useOperations } from "@/hooks/use-operations";
import { isDelayed } from "@/hooks/use-operations";
import { formatDate, formatKz } from "@/lib/utils";
import type { ReportSpec } from "@/lib/report-pdf";

type Finance = ReturnType<typeof useFinance>;
type Ops = ReturnType<typeof useOperations>;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_");
const AREA: Record<string, string> = { limpeza: "Limpeza", jardinagem: "Jardinagem", manutencao: "Manutenção" };

/** Relatório financeiro executivo (Administrador). */
export function financialReport(f: Finance, period: string, author: string): ReportSpec {
  const weak = f.byBlock.filter((b) => b.total && b.taxa < 80).sort((a, b) => a.taxa - b.taxa);
  const topExpense = [...f.expensesByCategory].sort((a, b) => b.value - a.value)[0];
  return {
    title: "Relatório Financeiro Executivo",
    subtitle: "Quotas trimestrais, cobrança, despesas e resultado",
    period,
    author,
    fileName: `Relatorio_Financeiro_${slug(period)}.pdf`,
    kpis: [
      { label: "Receita prevista", value: formatKz(f.expected) },
      { label: "Receita recebida", value: formatKz(f.received) },
      { label: "Montante em dívida", value: formatKz(f.debt) },
      { label: "Taxa de cobrança", value: pct(f.collectionRate) },
      { label: "Despesas totais", value: formatKz(f.expensesTotal) },
      { label: "Resultado financeiro", value: formatKz(f.result) },
    ],
    charts: [
      { title: "Receitas previstas vs. recebidas por trimestre", categories: f.quarterly.map((q) => q.label), series: [{ label: "Prevista", values: f.quarterly.map((q) => q.prevista) }, { label: "Recebida", values: f.quarterly.map((q) => q.recebida) }], unit: "kz" },
      { title: "Receitas vs. despesas por trimestre", categories: f.quarterly.map((q) => q.label), series: [{ label: "Receitas", values: f.quarterly.map((q) => q.recebida) }, { label: "Despesas", values: f.quarterly.map((q) => q.despesas) }], unit: "kz" },
      { title: "Taxa de pagamento por bloco", categories: f.byBlock.map((b) => b.block), series: [{ label: "Taxa (%)", values: f.byBlock.map((b) => b.taxa) }], unit: "pct" },
    ],
    summary: [
      `No período, foram emitidas quotas trimestrais no valor de ${formatKz(f.expected)}, das quais foram recebidos ${formatKz(f.received)} (taxa de cobrança de ${pct(f.collectionRate)}).`,
      `As despesas operacionais totalizaram ${formatKz(f.expensesTotal)}${topExpense ? `, com maior peso em ${topExpense.label} (${formatKz(topExpense.value)})` : ""}.`,
      `O resultado financeiro (recebido − despesas) é de ${formatKz(f.result)}.`,
      `Encontram-se em dívida ${formatKz(f.debt)} (${f.overdueCount} quotas em atraso e ${f.pendingCount} pendentes).`,
    ],
    pending: [
      ...(f.analysisCount ? [`${f.analysisCount} comprovativos a aguardar validação (${formatKz(f.analysis)}).`] : []),
      ...weak.slice(0, 5).map((b) => `Bloco ${b.block}: taxa de pagamento de ${b.taxa}% e dívida de ${formatKz(b.divida)}.`),
    ],
    recommendations: [
      ...(f.collectionRate < 0.9 ? ["Reforçar a cobrança: enviar lembretes aos condóminos com quotas em atraso e emitir circular de aviso."] : []),
      ...(weak.length ? [`Acompanhar especificamente os blocos ${weak.slice(0, 3).map((b) => b.block).join(", ")}, com menor taxa de pagamento.`] : []),
      ...(f.result < 0 ? ["Rever as despesas do período: o resultado financeiro é negativo."] : []),
      ...(f.analysisCount ? ["Validar os comprovativos pendentes para actualizar a situação dos condóminos."] : []),
    ],
    tables: [
      { title: "Situação por bloco", head: ["Bloco", "Quotas", "Pagas", "Taxa", "Dívida"], rows: f.byBlock.map((b) => [`Bloco ${b.block}`, b.total, b.pagas, `${b.taxa}%`, formatKz(b.divida)]) },
      { title: "Despesas por categoria", head: ["Categoria", "Valor"], rows: f.expensesByCategory.map((c) => [c.label, formatKz(c.value)]) },
    ],
  };
}

/** Relatório operacional (executivo ou do Gestor), conforme o tipo. */
export function operationalReport(
  kind: "executivo" | "diario" | "semanal" | "mensal" | "manutencao" | "ocorrencias" | "fiscalizacao",
  ops: Ops,
  period: string,
  author: string,
): ReportSpec {
  const titles = {
    executivo: "Relatório Operacional Executivo",
    diario: "Relatório Operacional Diário",
    semanal: "Relatório Operacional Semanal",
    mensal: "Relatório Operacional Mensal",
    manutencao: "Relatório de Manutenção",
    ocorrencias: "Relatório de Ocorrências",
    fiscalizacao: "Relatório de Fiscalização de Serviços",
  };
  const base = {
    title: titles[kind],
    subtitle: "Elevadores, ocorrências, limpeza, jardinagem e manutenção",
    period,
    author,
    fileName: `${slug(titles[kind])}_${slug(period)}.pdf`,
  };
  const delayed = ops.delayedTasks;
  const broken = ops.elevators.list.filter((e) => e.status !== "operacional");
  const openOcc = ops.occurrences.list.filter((o) => o.status !== "resolvida");
  const pending = [
    ...broken.map((e) => `Elevador ${e.code} (Bloco ${e.block}): ${e.status === "avariado" ? "avariado" : e.status === "em_manutencao" ? "em manutenção" : "fora de serviço"}.`),
    ...openOcc.filter((o) => o.priority === "urgente" || o.priority === "alta").slice(0, 6).map((o) => `Ocorrência ${o.priority}: ${o.title} — ${o.location} (${o.assignee ?? "sem responsável"}).`),
    ...delayed.slice(0, 6).map((t) => `${AREA[t.area]} atrasada: ${t.title} (previsto ${formatDate(t.dueDate ?? t.scheduledDate)}).`),
  ];
  const recommendations = [
    ...(broken.length ? ["Acompanhar com o prestador a reposição dos elevadores parados e informar os moradores dos blocos afectados."] : []),
    ...(ops.occurrences.urgent ? [`Priorizar as ${ops.occurrences.urgent} ocorrências urgentes em aberto.`] : []),
    ...(ops.cleaning.compliance < 0.9 ? ["Reforçar a fiscalização do plano de limpeza (cumprimento abaixo de 90%)."] : []),
    ...(ops.gardening.compliance < 0.9 ? ["Rever a calendarização da jardinagem (cumprimento abaixo de 90%)."] : []),
    ...(ops.maintenance.delayed ? [`Regularizar ${ops.maintenance.delayed} manutenções atrasadas junto dos prestadores.`] : []),
    ...(ops.occurrences.avgResolutionDays > 3 ? ["Reduzir o tempo médio de resolução das ocorrências (actualmente acima de 3 dias)."] : []),
  ];
  const kpisCommon = [
    { label: "Elevadores operacionais", value: `${ops.elevators.operacional}/${ops.elevators.total}` },
    { label: "Ocorrências abertas", value: String(ops.occurrences.open) },
    { label: "Ocorrências resolvidas", value: String(ops.occurrences.resolved) },
    { label: "Tempo médio de resolução", value: `${ops.occurrences.avgResolutionDays.toFixed(1)} dias` },
    { label: "Cumprimento do plano", value: pct(ops.planCompliance) },
    { label: "Tarefas atrasadas", value: String(delayed.length) },
  ];
  const areaChart = { title: "Execução por área (%)", categories: ["Limpeza", "Jardinagem", "Manutenção"], series: [{ label: "Execução", values: [ops.cleaning.compliance * 100, ops.gardening.compliance * 100, ops.maintenance.compliance * 100] }, { label: "Conformidade", values: [ops.cleaning.conformity * 100, ops.gardening.conformity * 100, ops.maintenance.conformity * 100] }], unit: "pct" as const };
  const occChart = { title: "Ocorrências por bloco", categories: ops.occurrences.byBlock.map((b) => b.label), series: [{ label: "Abertas", values: ops.occurrences.byBlock.map((b) => b.abertas) }, { label: "Resolvidas", values: ops.occurrences.byBlock.map((b) => b.resolvidas) }], unit: "n" as const };
  const summary = [
    `Elevadores: ${ops.elevators.operacional} operacionais, ${ops.elevators.avariado} avariados, ${ops.elevators.em_manutencao} em manutenção e ${ops.elevators.fora_servico} fora de serviço (inventário de demonstração).`,
    `Ocorrências: ${ops.occurrences.open} em aberto (${ops.occurrences.urgent} urgentes) e ${ops.occurrences.resolved} resolvidas no período, com resolução média de ${ops.occurrences.avgResolutionDays.toFixed(1)} dias.`,
    `Limpeza: ${ops.cleaning.done} de ${ops.cleaning.due} actividades executadas (${pct(ops.cleaning.compliance)}); jardinagem: ${ops.gardening.done} de ${ops.gardening.due} (${pct(ops.gardening.compliance)}).`,
    `Manutenção: ${ops.maintenance.preventiveDone}/${ops.maintenance.preventive} preventivas e ${ops.maintenance.correctiveDone}/${ops.maintenance.corrective} correctivas concluídas; custo efectivo de ${formatKz(ops.maintenance.actualCost)}.`,
  ];
  const taskRows = (list: typeof ops.tasks) => list.slice(0, 40).map((t) => [AREA[t.area], t.title, t.responsible.replace(" (demo)", ""), formatDate(t.scheduledDate), t.status === "concluida" ? "Concluída" : isDelayed(t) ? "Atrasada" : t.status === "em_execucao" ? "Em execução" : "Programada"]);

  if (kind === "manutencao") {
    const m = ops.tasks.filter((t) => t.area === "manutencao");
    return {
      ...base,
      kpis: [
        { label: "Preventivas concluídas", value: `${ops.maintenance.preventiveDone}/${ops.maintenance.preventive}` },
        { label: "Correctivas concluídas", value: `${ops.maintenance.correctiveDone}/${ops.maintenance.corrective}` },
        { label: "Manutenções pendentes", value: String(ops.maintenance.pending) },
        { label: "Atrasadas", value: String(ops.maintenance.delayed) },
        { label: "Custo efectivo", value: formatKz(ops.maintenance.actualCost) },
        { label: "Custo previsto em aberto", value: formatKz(ops.maintenance.estimatedOpen) },
      ],
      charts: [{ title: "Preventiva vs. correctiva", categories: ["Preventiva", "Correctiva"], series: [{ label: "Registadas", values: [ops.maintenance.preventive, ops.maintenance.corrective] }, { label: "Concluídas", values: [ops.maintenance.preventiveDone, ops.maintenance.correctiveDone] }], unit: "n" }],
      summary: summary.slice(3),
      pending: m.filter((t) => t.status !== "concluida").map((t) => `${t.type}: ${t.title} — ${t.responsible} (prazo ${formatDate(t.dueDate ?? t.scheduledDate)})${isDelayed(t) ? " · ATRASADA" : ""}.`),
      recommendations,
      tables: [{ title: "Intervenções", head: ["Tipo", "Intervenção", "Prestador", "Data", "Custo"], rows: m.map((t) => [t.type, t.title, t.responsible.replace(" (demo)", ""), formatDate(t.executedDate ?? t.scheduledDate), t.actualCost ? formatKz(t.actualCost) : t.estimatedCost ? `≈ ${formatKz(t.estimatedCost)}` : "—"]) }],
    };
  }
  if (kind === "ocorrencias") {
    return {
      ...base,
      kpis: kpisCommon.slice(1, 4).concat([{ label: "Urgentes em aberto", value: String(ops.occurrences.urgent) }, { label: "Total no período", value: String(ops.occurrences.list.length) }, { label: "Categorias", value: String(ops.occurrences.byCategory.length) }]),
      charts: [occChart, { title: "Ocorrências por categoria", categories: ops.occurrences.byCategory.map((c) => c.label.slice(0, 10)), series: [{ label: "Ocorrências", values: ops.occurrences.byCategory.map((c) => c.value) }], unit: "n" }],
      summary: summary.slice(1, 2),
      pending: openOcc.map((o) => `${o.priority.toUpperCase()} · ${o.title} — ${o.location} (${o.assignee ?? "sem responsável"}).`).slice(0, 20),
      recommendations,
      tables: [{ title: "Ocorrências", head: ["Categoria", "Ocorrência", "Bloco", "Prioridade", "Estado"], rows: ops.occurrences.list.slice(0, 40).map((o) => [o.category, o.title, o.block ?? "Comum", o.priority, o.status.replace("_", " ")]) }],
    };
  }
  if (kind === "fiscalizacao") {
    const inspected = ops.tasks.filter((t) => t.inspection);
    return {
      ...base,
      kpis: [
        { label: "Limpeza — execução", value: pct(ops.cleaning.compliance) },
        { label: "Limpeza — conformidade", value: pct(ops.cleaning.conformity) },
        { label: "Jardinagem — execução", value: pct(ops.gardening.compliance) },
        { label: "Jardinagem — conformidade", value: pct(ops.gardening.conformity) },
        { label: "Inspecções realizadas", value: String(inspected.length) },
        { label: "Não conformidades", value: String(inspected.filter((t) => t.inspection!.result === "nao_conforme").length) },
      ],
      charts: [areaChart, { title: "Execução por equipa (%)", categories: ops.teams.map((t) => t.team.replace(" (demo)", "").replace("Equipa de ", "").slice(0, 14)), series: [{ label: "Execução", values: ops.teams.map((t) => t.rate) }], unit: "pct" }],
      summary: summary.slice(2, 3),
      pending: inspected.filter((t) => t.inspection!.result === "nao_conforme").map((t) => `Não conforme: ${t.title} (${formatDate(t.executedDate ?? t.scheduledDate)}) — ${t.inspection!.notes ?? "sem observações"}.`),
      recommendations,
      tables: [{ title: "Registo de fiscalização", head: ["Área", "Actividade", "Equipa", "Data", "Resultado"], rows: inspected.slice(0, 40).map((t) => [AREA[t.area], t.title, t.responsible.replace(" (demo)", ""), formatDate(t.executedDate ?? t.scheduledDate), t.inspection!.result === "conforme" ? "Conforme" : "Não conforme"]) }],
    };
  }
  return {
    ...base,
    kpis: kpisCommon,
    charts: kind === "diario" ? [areaChart] : [areaChart, occChart],
    summary,
    pending,
    recommendations,
    tables: kind === "executivo" ? [{ title: "Desempenho das equipas", head: ["Equipa", "Previstas", "Executadas", "No prazo", "Execução"], rows: ops.teams.map((t) => [t.team.replace(" (demo)", ""), t.total, t.done, t.onTime, `${t.rate}%`]) }] : [{ title: "Actividades do período", head: ["Área", "Actividade", "Responsável", "Data", "Estado"], rows: taskRows(ops.tasks) }],
  };
}
