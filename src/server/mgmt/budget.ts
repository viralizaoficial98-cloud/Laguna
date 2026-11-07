/**
 * Orçamento anual e execução. Três origens mantidas SEPARADAS:
 *  - orçamento aprovado (rubricas, valores anuais e mensais);
 *  - execução histórica do ficheiro de origem (por trimestre, origem "ficheiro");
 *  - movimentos do sistema: despesas (por rubrica), receitas registadas e quotas recebidas
 *    (repartidas pelas rubricas com `quotaShare`, ex.: 90 % despesas correntes / 10 % fundo de reserva).
 * Os totais dos grupos são sempre calculados a partir das rubricas-folha (evita dupla contabilização).
 */
import type { Session } from "@/types";
import { prisma } from "../db";
import { ActionError } from "../errors";
import { auditLog, isoDate, mid, money, periodOf, requirePerm, toDateOnly, withWrite } from "./common";

const Q = [1, 2, 3, 4] as const;

export interface LineView {
  id: string;
  parentId: string | null;
  kind: string;
  name: string;
  position: number;
  isGroup: boolean;
  depth: number;
  quotaShare: number | null;
  note: string | null;
  annual: number;
  monthly: number[];
  file: Record<string, number>;
  system: Record<string, number>;
  systemMonthly: number[];
  executed: number;
  available: number;
  deviation: number;
  deviationPct: number | null;
  over: boolean;
  overlap: string[];
}

export async function getBudget(sess: Session, year: number) {
  requirePerm(sess, "budget.view");
  const budget = await prisma.budget.findUnique({ where: { year }, include: { lines: { include: { executions: true }, orderBy: { position: "asc" } } } });
  if (!budget) return { budget: null, lines: [], totals: null, years: (await prisma.budget.findMany({ select: { year: true } })).map((b) => b.year) };
  const from = new Date(`${year}-01-01T00:00:00.000Z`);
  const to = new Date(`${year + 1}-01-01T00:00:00.000Z`);
  const [expenses, revenues, payments] = await Promise.all([
    prisma.expense.findMany({ where: { budgetLineId: { not: null }, OR: [{ status: null }, { status: { not: "anulada" } }], date: { gte: from, lt: to } } }),
    prisma.revenue.findMany({ where: { status: "registada", date: { gte: from, lt: to } } }),
    prisma.payment.findMany({ where: { status: "aprovado", paidAt: { gte: from, lt: to } } }),
  ]);
  const raw = budget.lines;
  const byId = new Map(raw.map((l) => [l.id, l]));
  const children = (id: string) => raw.filter((l) => l.parentId === id);
  const depth = (l: (typeof raw)[number]): number => (l.parentId && byId.has(l.parentId) ? depth(byId.get(l.parentId)!) + 1 : 0);
  const quotaMonthly = Array(12).fill(0);
  for (const p of payments) quotaMonthly[p.paidAt.getUTCMonth()] += Number(p.validatedAmount ?? p.amount);

  const leaf = (l: (typeof raw)[number]) => {
    const annual = Number(l.annualAmount);
    const monthly: number[] = l.monthly ? JSON.parse(l.monthly) : Array(12).fill(Math.round((annual / 12) * 100) / 100);
    const file: Record<string, number> = {};
    for (const e of l.executions) file[e.period] = (file[e.period] ?? 0) + Number(e.amount);
    const sm = Array(12).fill(0);
    for (const e of expenses.filter((x) => x.budgetLineId === l.id)) sm[(e.paymentDate ?? e.date).getUTCMonth()] += Number(e.amount);
    for (const r of revenues.filter((x) => x.budgetLineId === l.id)) sm[r.date.getUTCMonth()] += Number(r.amount);
    if (l.quotaShare) quotaMonthly.forEach((v, i) => (sm[i] += Math.round(v * Number(l.quotaShare) * 100) / 100));
    return { annual, monthly, file, sm };
  };

  const compute = (l: (typeof raw)[number]): Omit<LineView, "executed" | "available" | "deviation" | "deviationPct" | "over" | "overlap"> & { periodBudget?: number } => {
    const kids = children(l.id);
    if (!kids.length) {
      const v = leaf(l);
      const system: Record<string, number> = {};
      Q.forEach((q) => (system[`${year}-T${q}`] = Math.round(v.sm.slice((q - 1) * 3, q * 3).reduce((a, b) => a + b, 0) * 100) / 100));
      return { id: l.id, parentId: l.parentId, kind: l.kind, name: l.name, position: l.position, isGroup: false, depth: depth(l), quotaShare: l.quotaShare ? Number(l.quotaShare) : null, note: l.note, annual: v.annual, monthly: v.monthly, file: v.file, system, systemMonthly: v.sm };
    }
    const parts = kids.map(compute);
    const sum = (f: (p: (typeof parts)[number]) => number) => Math.round(parts.reduce((a, p) => a + f(p), 0) * 100) / 100;
    const keys = (k: "file" | "system") => [...new Set(parts.flatMap((p) => Object.keys(p[k])))];
    return {
      id: l.id,
      parentId: l.parentId,
      kind: l.kind,
      name: l.name,
      position: l.position,
      isGroup: true,
      depth: depth(l),
      quotaShare: null,
      note: l.note,
      annual: sum((p) => p.annual),
      monthly: Array.from({ length: 12 }, (_, i) => sum((p) => p.monthly[i])),
      file: Object.fromEntries(keys("file").map((k) => [k, sum((p) => p.file[k] ?? 0)])),
      system: Object.fromEntries(keys("system").map((k) => [k, sum((p) => p.system[k] ?? 0)])),
      systemMonthly: Array.from({ length: 12 }, (_, i) => sum((p) => p.systemMonthly[i])),
    };
  };

  const lines: LineView[] = raw.map((l) => {
    const c = compute(l);
    // por trimestre: a execução histórica do ficheiro prevalece; o sistema conta nos trimestres sem dados do ficheiro
    // (evita contar duas vezes o mesmo período; a sobreposição fica assinalada para validação)
    const periods = [...new Set([...Object.keys(c.file), ...Object.keys(c.system)])];
    const executed = Math.round(periods.reduce((a, k) => a + ((c.file[k] ?? 0) !== 0 ? c.file[k] : (c.system[k] ?? 0)), 0) * 100) / 100;
    const overlap = Object.keys(c.file).filter((k) => (c.file[k] ?? 0) !== 0 && (c.system[k] ?? 0) !== 0);
    // grupos sem execução própria no ficheiro herdam a execução de origem do ficheiro guardada no grupo
    if (c.isGroup) {
      const own = byId.get(l.id)!.executions;
      if (own.length && !Object.keys(c.file).length) for (const e of own) c.file[e.period] = (c.file[e.period] ?? 0) + Number(e.amount);
    }
    const deviation = Math.round((executed - c.annual) * 100) / 100;
    return { ...c, executed, available: Math.round((c.annual - executed) * 100) / 100, deviation, deviationPct: c.annual ? Math.round((deviation / c.annual) * 1000) / 10 : null, over: c.kind !== "receita" && executed > c.annual + 0.005, overlap };
  });

  // totais a partir das rubricas-folha (sem dupla contabilização)
  const leaves = lines.filter((l) => !l.isGroup);
  const tot = (kind: string) => {
    const ls = leaves.filter((l) => l.kind === kind);
    const s = (f: (l: LineView) => number) => Math.round(ls.reduce((a, l) => a + f(l), 0) * 100) / 100;
    return {
      annual: s((l) => l.annual),
      executed: s((l) => l.executed),
      file: s((l) => Object.values(l.file).reduce((a, b) => a + b, 0)),
      system: s((l) => Object.values(l.system).reduce((a, b) => a + b, 0)),
      overlapping: ls.filter((l) => l.overlap.length).length,
    };
  };
  const revenue = tot("receita");
  const expense = tot("despesa");
  const fund = tot("fundo");
  return {
    budget: { id: budget.id, year: budget.year, name: budget.name, status: budget.status, source: budget.source, notes: budget.notes, sourceInfo: budget.sourceInfo ? JSON.parse(budget.sourceInfo) : null, createdAt: budget.createdAt.toISOString() },
    lines,
    totals: { revenue, expense, fund, balanceBudget: Math.round((revenue.annual - expense.annual) * 100) / 100, balanceExecuted: Math.round((revenue.executed - expense.executed) * 100) / 100 },
    years: (await prisma.budget.findMany({ select: { year: true } })).map((b) => b.year),
  };
}

export async function updateLine(sess: Session, id: string, patch: { name?: string; annualAmount?: number; monthly?: number[] | null; note?: string | null }) {
  requirePerm(sess, "budget.manage");
  return withWrite(async (tx) => {
    const l = await tx.budgetLine.findUnique({ where: { id } });
    if (!l) throw new ActionError("Rubrica inexistente.", 404);
    if (l.isGroup && patch.annualAmount !== undefined) throw new ActionError("O valor de um grupo é a soma das sub-rubricas.", 400);
    if (patch.monthly && (patch.monthly.length !== 12 || patch.monthly.some((v) => !(v >= 0)))) throw new ActionError("Indique 12 valores mensais não negativos.", 400);
    if (patch.annualAmount !== undefined && !(patch.annualAmount >= 0)) throw new ActionError("Valor anual inválido.", 400);
    const data = {
      ...(patch.name ? { name: patch.name.trim().slice(0, 255) } : {}),
      ...(patch.annualAmount !== undefined ? { annualAmount: money(patch.annualAmount).toFixed(2) } : {}),
      ...(patch.monthly !== undefined ? { monthly: patch.monthly ? JSON.stringify(patch.monthly.map(money)) : null } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
    };
    // se o mensal for definido, o anual passa a ser a soma dos meses
    if (patch.monthly) Object.assign(data, { annualAmount: money(patch.monthly.reduce((a, b) => a + b, 0)).toFixed(2) });
    await tx.budgetLine.update({ where: { id }, data });
    await auditLog(tx, sess, "Rubrica orçamental alterada", "budget_line", id, `${l.name}: ${Number(l.annualAmount)} → ${"annualAmount" in data ? data.annualAmount : Number(l.annualAmount)}`);
    return { ok: true };
  }, { bump: false });
}

export async function addLine(sess: Session, input: { budgetId: string; parentId?: string | null; kind: string; name: string; annualAmount: number }) {
  requirePerm(sess, "budget.manage");
  if (!["receita", "despesa", "fundo"].includes(input.kind)) throw new ActionError("Tipo inválido.", 400);
  if (!input.name?.trim()) throw new ActionError("Indique o nome da rubrica.", 400);
  return withWrite(async (tx) => {
    const b = await tx.budget.findUnique({ where: { id: input.budgetId } });
    if (!b) throw new ActionError("Orçamento inexistente.", 404);
    if (input.parentId) {
      const p = await tx.budgetLine.findUnique({ where: { id: input.parentId } });
      if (!p || p.budgetId !== b.id) throw new ActionError("Rubrica-mãe inválida.", 400);
      if (!p.isGroup) {
        if ((await tx.budgetExecution.count({ where: { lineId: p.id } })) || (await tx.expense.count({ where: { budgetLineId: p.id } }))) throw new ActionError("A rubrica-mãe já tem execução — não pode passar a grupo.", 400);
        await tx.budgetLine.update({ where: { id: p.id }, data: { isGroup: true } });
      }
    }
    const max = await tx.budgetLine.aggregate({ where: { budgetId: b.id }, _max: { position: true } });
    const line = await tx.budgetLine.create({ data: { id: mid("bl"), budgetId: b.id, parentId: input.parentId ?? null, kind: input.kind, name: input.name.trim(), position: (max._max.position ?? 0) + 1, annualAmount: money(input.annualAmount).toFixed(2), isGroup: false } });
    await auditLog(tx, sess, "Rubrica orçamental criada", "budget_line", line.id, `${line.name} · ${input.annualAmount}`);
    return { id: line.id };
  }, { bump: false });
}

export async function deleteLine(sess: Session, id: string) {
  requirePerm(sess, "budget.manage");
  return withWrite(async (tx) => {
    const l = await tx.budgetLine.findUnique({ where: { id } });
    if (!l) throw new ActionError("Rubrica inexistente.", 404);
    const used = (await tx.budgetLine.count({ where: { parentId: id } })) + (await tx.budgetExecution.count({ where: { lineId: id } })) + (await tx.expense.count({ where: { budgetLineId: id } })) + (await tx.revenue.count({ where: { budgetLineId: id } }));
    if (used) throw new ActionError("A rubrica tem sub-rubricas, execução ou movimentos associados — não pode ser eliminada.", 409);
    await tx.budgetLine.delete({ where: { id } });
    await auditLog(tx, sess, "Rubrica orçamental eliminada", "budget_line", id, l.name);
    return { ok: true };
  }, { bump: false });
}

// ————— receitas —————

export async function listRevenues(sess: Session, year?: number) {
  requirePerm(sess, "budget.view");
  const where = year ? { date: { gte: new Date(`${year}-01-01T00:00:00Z`), lt: new Date(`${year + 1}-01-01T00:00:00Z`) } } : {};
  const rows = await prisma.revenue.findMany({ where, orderBy: { date: "desc" } });
  return rows.map((r) => ({ id: r.id, date: isoDate(r.date)!, period: r.period, budgetLineId: r.budgetLineId, category: r.category, description: r.description, amount: Number(r.amount), apartmentId: r.apartmentId, reference: r.reference, status: r.status, createdBy: r.createdBy, createdAt: r.createdAt.toISOString(), voidReason: r.voidReason }));
}

export async function createRevenue(sess: Session, r: { date: string; category: string; description: string; amount: number; budgetLineId?: string | null; reference?: string | null; apartmentId?: string | null; clientKey?: string }) {
  requirePerm(sess, "revenues.manage");
  if (!r.description?.trim() || !r.category?.trim()) throw new ActionError("Indique a categoria e a descrição.", 400);
  if (!(r.amount > 0)) throw new ActionError("Indique um valor positivo.", 400);
  return withWrite(async (tx) => {
    const id = r.clientKey && /^[a-z0-9]{8,40}$/.test(r.clientKey) ? `rev_${r.clientKey}` : mid("rev");
    if (await tx.revenue.findUnique({ where: { id } })) throw new ActionError("Esta receita já foi registada (pedido repetido).", 409);
    const created = await tx.revenue.create({
      data: { id, date: toDateOnly(r.date), period: periodOf(r.date), budgetLineId: r.budgetLineId || null, category: r.category.trim().slice(0, 80), description: r.description.trim().slice(0, 255), amount: money(r.amount).toFixed(2), reference: r.reference?.trim() || null, apartmentId: r.apartmentId || null, status: "registada", createdBy: sess.name },
    });
    await auditLog(tx, sess, "Receita registada", "revenue", created.id, `${r.description} · ${r.amount} Kz`);
    return { id: created.id };
  });
}

export async function voidRevenue(sess: Session, id: string, reason: string) {
  requirePerm(sess, "revenues.manage");
  if (!reason?.trim()) throw new ActionError("Indique o motivo da anulação.", 400);
  return withWrite(async (tx) => {
    const r = await tx.revenue.findUnique({ where: { id } });
    if (!r || r.status === "anulada") throw new ActionError("Receita inexistente ou já anulada.", 404);
    await tx.revenue.update({ where: { id }, data: { status: "anulada", voidReason: reason.trim() } });
    await auditLog(tx, sess, "Receita anulada", "revenue", id, reason.trim());
    return { ok: true };
  });
}

/** Resumo para os dashboards. */
export async function budgetSummary(sess: Session, year: number) {
  const b = await getBudget(sess, year);
  if (!b.budget || !b.totals) return { year, available: false as const };
  const top = b.lines.filter((l) => l.depth <= 1 && l.kind === "despesa").map((l) => ({ name: l.name, annual: l.annual, executed: l.executed, isGroup: l.isGroup, depth: l.depth }));
  return {
    year,
    available: true as const,
    totals: b.totals,
    expenseByLine: top,
    over: b.lines.filter((l) => l.over && !l.isGroup).map((l) => ({ name: l.name, annual: l.annual, executed: l.executed })),
    revenueByQuarter: Q.map((q) => {
      const k = `${year}-T${q}`;
      const leaves = b.lines.filter((l) => !l.isGroup && l.kind === "receita");
      const exp = b.lines.filter((l) => !l.isGroup && l.kind === "despesa");
      const val = (l: LineView) => ((l.file[k] ?? 0) !== 0 ? l.file[k] : (l.system[k] ?? 0));
      return { label: `T${q}`, receitas: Math.round(leaves.reduce((a, l) => a + val(l), 0)), despesas: Math.round(exp.reduce((a, l) => a + val(l), 0)), orcamento: Math.round(leaves.reduce((a, l) => a + l.annual / 4, 0)) };
    }),
  };
}
