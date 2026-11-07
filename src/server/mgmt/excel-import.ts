/**
 * Importação dos ficheiros Excel do condomínio para MySQL:
 *  - Fracções / proprietários (Nome) / inquilinos (Nome Fiscal);
 *  - Mapa mensal de gastos (despesas, fornecedores, IVA, retenções);
 *  - Execução orçamental anual (rubricas, valores anual/mensal, execução trimestral).
 *
 * Fluxo: ler → validar → normalizar (valores originais guardados) → conciliar com a base de dados → pré-visualizar →
 * decisões explícitas do utilizador → cópia de segurança → gravar numa transacção → relatório.
 * Nunca elimina registos; conflitos só são resolvidos com decisão explícita.
 */
import ExcelJS from "exceljs";
import { gzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ExpenseCategory, Session } from "@/types";
import { prisma, type Tx } from "../db";
import { ActionError } from "../errors";
import { storageDir } from "../files";
import { toRow } from "../mapping";
import { auditLog, cleanText, mid, money, normalizeName, periodOf, requirePerm, similarNames, withWrite } from "./common";
import { assignHolderTx, findOrCreateParty } from "./holders";

// ————————————————————————— leitura —————————————————————————

type Cell = string | number | Date | null;

function cellValue(v: ExcelJS.CellValue): Cell {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "object") {
    if ("result" in v) return cellValue((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    // fórmula (partilhada) sem valor em cache: o Excel não grava o resultado 0 nestas células
    if ("formula" in v || "sharedFormula" in v) return 0;
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
    if ("text" in v) return String((v as ExcelJS.CellHyperlinkValue).text);
    if ("error" in v) return null;
  }
  return String(v);
}

interface Sheet {
  name: string;
  rows: Cell[][];
}

async function readWorkbook(buf: Buffer): Promise<Sheet[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  return wb.worksheets.map((ws) => {
    const rows: Cell[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals: Cell[] = [];
      row.eachCell({ includeEmpty: true }, (c, col) => (vals[col - 1] = cellValue(c.value)));
      rows.push(Array.from(vals, (x) => x ?? null));
    });
    return { name: ws.name, rows };
  });
}

const txt = (c: Cell) => (c instanceof Date ? c.toISOString().slice(0, 10) : c === null ? "" : String(c));
const findHeader = (rows: Cell[][], needles: string[]) => rows.findIndex((r) => needles.every((n) => r.some((c) => normalizeName(txt(c)) === normalizeName(n))));

/** "1 080 000,00 Kz" → 1080000; "- Kz" → 0. Devolve também o texto original. */
function parseKz(c: Cell): { value: number; raw: string } {
  if (typeof c === "number") return { value: money(c), raw: String(c) };
  const raw = txt(c);
  const s = raw.replace(/kz/i, "").replace(/ | /g, " ").trim();
  if (!s || s === "-") return { value: 0, raw };
  const n = Number(s.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) throw new Error(`Valor monetário inválido: "${raw}"`);
  return { value: money(n), raw };
}

function parseDate(c: Cell): string | null {
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  const s = txt(c).trim();
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

// ————————————————————————— tipos do plano —————————————————————————

export type FileKind = "fraccoes" | "despesas" | "orcamento";

export interface FractionItem {
  row: number;
  code: string;
  apartmentId: string | null;
  owner: { raw: string; name: string };
  tenant: { raw: string; name: string } | null;
  ownerOccupied: boolean;
  ownerStatus: "novo" | "igual" | "conflito";
  currentOwner: string | null;
  tenantStatus: "novo" | "igual" | "conflito" | "sem_inquilino";
  currentTenant: string | null;
  cadastreOwnerName: string | null;
  occupantStatus: "conciliado" | "conflito" | "sem_morador" | "bloqueado_conta";
  currentResident: string | null;
  issues: string[];
}

export interface ExpenseItem {
  row: number;
  number: number;
  supplierName: string;
  nif: string | null;
  nifRaw: string;
  invoiceRef: string;
  invoiceDate: string | null;
  paymentDate: string | null;
  description: string;
  amount: number;
  vat: number;
  withholding: number;
  net: number;
  raw: Record<string, string>;
  category: ExpenseCategory;
  suggestedLineName: string | null;
  duplicateOf: string | null;
  possibleDuplicateRows: number[];
  arithmeticOk: boolean;
  issues: string[];
}

export interface BudgetLineItem {
  id: string;
  row: number;
  name: string;
  kind: "receita" | "despesa" | "fundo";
  parentId: string | null;
  isGroup: boolean;
  annual: number;
  annualRaw: number | string | null;
  monthlyRaw: number | string | null;
  quotaShare: number | null;
  quarters: number[];
  status: "novo" | "igual" | "conflito";
  current: number | null;
  position?: number;
}

export interface Plan {
  files: { fileId: string; name: string; kind: FileKind | null; sheets: string[] }[];
  fractions?: { items: FractionItem[]; possibleDuplicates: [string, string][]; owners: number; tenants: number; ownerOccupied: number };
  expenses?: {
    month: string | null;
    items: ExpenseItem[];
    totals: { file: Record<string, number>; computed: Record<string, number>; reconciled: boolean };
    suppliers: { name: string; nif: string | null; exists: boolean }[];
    demoSameMonth: { id: string; description: string; amount: number }[];
  };
  budget?: { year: number; exists: boolean; lines: BudgetLineItem[]; divergences: string[]; sourceInfo: Record<string, unknown> };
  warnings: string[];
}

export interface Decisions {
  /** fracções em que o proprietário activo existente é substituído pelo do ficheiro */
  replaceOwner?: string[];
  replaceTenant?: string[];
  /** actualizar o nome do proprietário no cadastro do apartamento */
  updateOwnerName?: string[];
  /** substituir o morador/ocupante actual pelo do ficheiro (o anterior fica inactivo com histórico) */
  replaceOccupant?: string[];
  /** pares de nomes a tratar como a mesma pessoa/entidade */
  mergeNames?: [string, string][];
  /** linhas do mapa de gastos a NÃO importar */
  skipExpenseRows?: number[];
  /** rubrica orçamental por linha do mapa (id da rubrica) */
  expenseLines?: Record<string, string | null>;
  /** anular (não apagar) as despesas de demonstração do mesmo mês */
  voidDemoSameMonth?: boolean;
  /** rubricas do orçamento existentes a substituir pelos valores do ficheiro */
  overwriteBudgetLines?: string[];
}

// ————————————————————————— detecção e análise —————————————————————————

function detect(sheets: Sheet[]): FileKind | null {
  for (const s of sheets) {
    if (findHeader(s.rows, ["Fracção", "Nome", "Nome Fiscal"]) >= 0) return "fraccoes";
    if (findHeader(s.rows, ["NIF", "REF. FACTURA", "VALOR"]) >= 0) return "despesas";
    if (s.rows.some((r) => r.some((c) => /ORÇAMENTO PARA \d{4}/i.test(txt(c)))) && s.rows.some((r) => normalizeName(txt(r[0])) === "rubrica")) return "orcamento";
  }
  return null;
}

const CATEGORY_RULES: { re: RegExp; category: ExpenseCategory; line: string | null }[] = [
  { re: /bot(õ|o)es de chamada/i, category: "Elevadores", line: "Manutenção de Elevadores - Materiais" },
  { re: /elevador/i, category: "Elevadores", line: "Manutenção de elevadores - Serviços" },
  { re: /electobomba|electrobomba|inc(ê|e)ndio/i, category: "Manutenção", line: "Recuperação sistema incêndios e parque de electrobombas" },
  { re: /(á|a)gua/i, category: "Energia e água", line: "Água potável de rede pública - EPAL" },
  { re: /lixo/i, category: "Limpeza", line: "Recolha de lixo" },
  { re: /pragas|fumiga|desparasit/i, category: "Limpeza", line: "Fumigação e desparasitagem" },
  { re: /gerador/i, category: "Manutenção", line: "Manutenção de geradores - Serviços" },
  { re: /bateria/i, category: "Manutenção", line: "Manutenção de Geradores - Materiais" },
  { re: /ctb|contab|gest(ã|a)o de condom/i, category: "Administração", line: "Serviço de contabilidade e compras" },
  { re: /seguran/i, category: "Segurança e portaria", line: "Despesas com pessoal - Segurança" },
  { re: /r(á|a)dio/i, category: "Segurança e portaria", line: "Outras despesas de conservação e funcionamento" },
  { re: /broca|ferrament/i, category: "Manutenção", line: "Ferramentas e utensílios desgaste rápido" },
  { re: /l(â|a)mpada|led|adesivo|materiais/i, category: "Manutenção", line: "Materiais de reparação e reposição - Outros" },
  { re: /reparaç(ã|a)o|manuten(ç|c)(ã|a)o preventiva|acs\b/i, category: "Manutenção", line: "Despesas de conservação e reabilitação" },
  { re: /contentor/i, category: "Manutenção", line: "Outras despesas de conservação e funcionamento" },
  // impostos entregues ao Estado (IRT, retenções) — rubrica a validar pela gestão
  { re: /\birt\b|\brf\b|pagto de/i, category: "Administração", line: null },
];

export const lineIdFor = (year: number, name: string) => `bl_${year}_${normalizeName(name).slice(0, 100)}`;

async function analyseFractions(sheets: Sheet[], plan: Plan) {
  const s = sheets.find((x) => findHeader(x.rows, ["Fracção", "Nome", "Nome Fiscal"]) >= 0)!;
  const h = findHeader(s.rows, ["Fracção", "Nome", "Nome Fiscal"]);
  const head = s.rows[h].map((c) => normalizeName(txt(c)));
  const iF = head.indexOf("fraccao");
  const iN = head.indexOf("nome");
  const iT = head.indexOf("nomefiscal");
  const [apts, residents, users, slots] = await Promise.all([
    prisma.apartment.findMany(),
    prisma.resident.findMany(),
    prisma.user.findMany({ where: { residentId: { not: null } }, select: { residentId: true, email: true } }),
    prisma.activeHolderSlot.findMany(),
  ]);
  const holders = await prisma.fractionHolder.findMany({ where: { id: { in: slots.map((x) => x.holderId) } }, include: { party: true } });
  const items: FractionItem[] = [];
  const seen = new Set<string>();
  s.rows.slice(h + 1).forEach((r, i) => {
    const code = cleanText(r[iF]);
    if (!code) return;
    const row = h + i + 2;
    const issues: string[] = [];
    const m = /^(\d{2})-(\d{3})$/.exec(code);
    const apt = m ? apts.find((a) => a.block === m[1] && a.number === m[2]) : undefined;
    if (!m) issues.push(`Formato de fracção inválido: "${code}"`);
    else if (!apt) issues.push("Fracção inexistente no cadastro de 100 apartamentos.");
    if (seen.has(code)) issues.push("Fracção repetida no ficheiro.");
    seen.add(code);
    const ownerRaw = txt(r[iN]);
    const tenantRaw = txt(r[iT]);
    const owner = { raw: ownerRaw, name: cleanText(ownerRaw) };
    if (!owner.name) issues.push("Proprietário (Nome) em falta.");
    const tenantName = cleanText(tenantRaw);
    const ownerOccupied = !!tenantName && normalizeName(tenantName) === normalizeName(owner.name);
    const tenant = tenantName && !ownerOccupied ? { raw: tenantRaw, name: tenantName } : null;
    if (ownerRaw !== owner.name || (tenantRaw && tenantRaw !== tenantName)) issues.push("Espaços ou quebras de linha removidos (original guardado).");
    const curOwner = apt ? holders.find((x) => x.apartmentId === apt.id && x.role === "proprietario")?.party ?? null : null;
    const curTenant = apt ? holders.find((x) => x.apartmentId === apt.id && x.role === "inquilino")?.party ?? null : null;
    const resident = apt?.residentId ? residents.find((x) => x.id === apt.residentId) : undefined;
    const occupant = tenant?.name ?? owner.name;
    const linkedUser = resident ? users.find((u) => u.residentId === resident.id) : undefined;
    items.push({
      row,
      code,
      apartmentId: apt?.id ?? null,
      owner,
      tenant,
      ownerOccupied,
      ownerStatus: !curOwner ? "novo" : normalizeName(curOwner.name) === normalizeName(owner.name) ? "igual" : "conflito",
      currentOwner: curOwner?.name ?? null,
      tenantStatus: !tenant ? "sem_inquilino" : !curTenant ? "novo" : normalizeName(curTenant.name) === normalizeName(tenant.name) ? "igual" : "conflito",
      currentTenant: curTenant?.name ?? null,
      cadastreOwnerName: apt?.ownerName ?? null,
      occupantStatus: !resident ? "sem_morador" : normalizeName(resident.name) === normalizeName(occupant) ? "conciliado" : linkedUser ? "bloqueado_conta" : "conflito",
      currentResident: resident ? `${resident.name}${linkedUser ? ` (conta ${linkedUser.email})` : ""}` : null,
      issues,
    });
  });
  if (items.length !== 100) plan.warnings.push(`O ficheiro de fracções tem ${items.length} linhas (esperadas 100).`);
  const names = new Map<string, string>();
  for (const it of items) {
    names.set(normalizeName(it.owner.name), it.owner.name);
    if (it.tenant) names.set(normalizeName(it.tenant.name), it.tenant.name);
  }
  for (const p of await prisma.party.findMany({ where: { archived: false }, select: { name: true, normalizedName: true } })) if (!names.has(p.normalizedName)) names.set(p.normalizedName, p.name);
  const list = [...names.values()].sort();
  const possibleDuplicates: [string, string][] = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (similarNames(list[i], list[j])) possibleDuplicates.push([list[i], list[j]]);
  plan.fractions = {
    items,
    possibleDuplicates,
    owners: new Set(items.map((x) => normalizeName(x.owner.name))).size,
    tenants: new Set(items.filter((x) => x.tenant).map((x) => normalizeName(x.tenant!.name))).size,
    ownerOccupied: items.filter((x) => x.ownerOccupied).length,
  };
}

async function analyseExpenses(sheets: Sheet[], plan: Plan) {
  const s = sheets.find((x) => findHeader(x.rows, ["NIF", "REF. FACTURA", "VALOR"]) >= 0)!;
  const h = findHeader(s.rows, ["NIF", "REF. FACTURA", "VALOR"]);
  const head = s.rows[h].map((c) => normalizeName(txt(c)));
  const col = (n: string) => head.findIndex((x) => x === normalizeName(n) || x.startsWith(normalizeName(n)));
  const c = { n: col("N.º"), name: col("NOME"), nif: col("NIF"), ref: col("REF. FACTURA"), inv: col("DATA DA FACTURA"), pay: col("DATA DO PAGAMENTO"), desc: col("DESCRIÇÃO"), val: col("VALOR"), iva: col("IVA"), ret: col("RETENÇÃO"), net: col("LÍQUIDO") };
  const title = sheets.flatMap((x) => x.rows.flat()).map(txt).find((t) => /MAPA MENSAL DE GASTOS/i.test(t)) ?? "";
  const months = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
  const mm = new RegExp(`(${months.join("|")})\\s*/\\s*(\\d{4})`, "i").exec(title);
  const month = mm ? `${mm[2]}-${String(months.indexOf(mm[1].toUpperCase()) + 1).padStart(2, "0")}` : null;
  const [existing, suppliers] = await Promise.all([prisma.expense.findMany(), prisma.supplier.findMany()]);
  const items: ExpenseItem[] = [];
  let fileTotals: Record<string, number> = {};
  s.rows.slice(h + 1).forEach((r, i) => {
    const row = h + i + 2;
    const nRaw = r[c.n];
    if ((nRaw === null || txt(nRaw) === "") && r[c.val] !== null && txt(r[c.val]) !== "") {
      fileTotals = { valor: parseKz(r[c.val]).value, iva: parseKz(r[c.iva]).value, retencao: parseKz(r[c.ret]).value, liquido: parseKz(r[c.net]).value };
      return;
    }
    if (typeof nRaw !== "number" && !/^\d+$/.test(txt(nRaw))) return;
    const issues: string[] = [];
    const raw = Object.fromEntries(Object.entries(c).map(([k, i2]) => [k, txt(r[i2])]));
    const val = parseKz(r[c.val]);
    const iva = parseKz(r[c.iva]);
    const ret = parseKz(r[c.ret]);
    const net = parseKz(r[c.net]);
    const nifRaw = cleanText(r[c.nif]);
    const nif = /^s\/?n$/i.test(nifRaw) || !nifRaw ? null : nifRaw;
    if (!nif) issues.push("Sem NIF (\"S/N\") — identificado pelo nome.");
    const supplierName = cleanText(r[c.name]);
    const invoiceRef = cleanText(r[c.ref]);
    const invoiceDate = parseDate(r[c.inv]);
    const paymentDate = parseDate(r[c.pay]);
    if (!paymentDate) issues.push("Data de pagamento em falta ou inválida.");
    const arithmeticOk = Math.abs(val.value + iva.value - ret.value - net.value) < 0.01;
    if (!arithmeticOk) issues.push(`Valor + IVA − Retenção (${money(val.value + iva.value - ret.value)}) ≠ Líquido (${net.value}) — valores mantidos, a validar.`);
    const description = cleanText(r[c.desc]);
    const rule = CATEGORY_RULES.find((x) => x.re.test(description));
    const dup = existing.find((e) => e.status !== "anulada" && e.invoiceRef && normalizeName(e.invoiceRef) === normalizeName(invoiceRef) && ((nif && e.nif === nif) || normalizeName(e.supplierName) === normalizeName(supplierName)));
    if (dup) issues.push(`Já importada/registada (despesa ${dup.id}) — não será duplicada.`);
    items.push({
      row,
      number: Number(txt(nRaw)),
      supplierName,
      nif,
      nifRaw,
      invoiceRef,
      invoiceDate,
      paymentDate,
      description,
      amount: val.value,
      vat: iva.value,
      withholding: ret.value,
      net: net.value,
      raw,
      category: rule?.category ?? "Manutenção",
      suggestedLineName: rule ? rule.line : null,
      duplicateOf: dup?.id ?? null,
      possibleDuplicateRows: [],
      arithmeticOk,
      issues,
    });
  });
  // possíveis duplicados dentro do ficheiro: mesmo fornecedor, data e valor com referências diferentes
  for (const a of items)
    for (const b of items)
      if (a !== b && normalizeName(a.supplierName) === normalizeName(b.supplierName) && a.paymentDate === b.paymentDate && a.amount === b.amount && a.invoiceRef !== b.invoiceRef) a.possibleDuplicateRows.push(b.number);
  items.filter((x) => x.possibleDuplicateRows.length).forEach((x) => x.issues.push(`Possível duplicado das linhas ${x.possibleDuplicateRows.join(", ")} (mesmo fornecedor, data e valor; referência diferente) — validar.`));
  const sum = (f: (x: ExpenseItem) => number) => money(items.reduce((a, x) => a + f(x), 0));
  const computed = { valor: sum((x) => x.amount), iva: sum((x) => x.vat), retencao: sum((x) => x.withholding), liquido: sum((x) => x.net) };
  const reconciled = Object.keys(computed).every((k) => Math.abs((computed as Record<string, number>)[k] - (fileTotals[k] ?? NaN)) < 0.01);
  if (!reconciled) plan.warnings.push("Os totais do mapa de gastos não coincidem com a soma das linhas — valores mantidos, ver relatório.");
  const supMap = new Map<string, { name: string; nif: string | null; exists: boolean }>();
  for (const it of items) {
    const key = it.nif ?? `n:${normalizeName(it.supplierName)}`;
    if (!supMap.has(key)) supMap.set(key, { name: it.supplierName, nif: it.nif, exists: suppliers.some((sp) => (it.nif && sp.nif === it.nif) || normalizeName(sp.name) === normalizeName(it.supplierName)) });
  }
  const demoSameMonth = month
    ? existing.filter((e) => !e.source && !e.invoiceRef && e.status !== "anulada" && e.date.toISOString().slice(0, 7) === month).map((e) => ({ id: e.id, description: e.description, amount: Number(e.amount) }))
    : [];
  if (demoSameMonth.length) plan.warnings.push(`Existem ${demoSameMonth.length} despesas de demonstração em ${month} que somariam às importadas — decida se as anula (não são apagadas).`);
  plan.expenses = { month, items, totals: { file: fileTotals, computed, reconciled }, suppliers: [...supMap.values()], demoSameMonth };
}

async function analyseBudget(sheets: Sheet[], plan: Plan) {
  const s = sheets.find((x) => x.rows.some((r) => r.some((c) => /ORÇAMENTO PARA \d{4}/i.test(txt(c)))))!;
  const year = Number(/ORÇAMENTO PARA (\d{4})/i.exec(s.rows.flat().map(txt).find((t) => /ORÇAMENTO PARA \d{4}/i.test(t))!)![1]);
  const budget = await prisma.budget.findUnique({ where: { year }, include: { lines: { include: { executions: true } } } });
  const lines: BudgetLineItem[] = [];
  const divergences: string[] = [];
  const sourceInfo: Record<string, unknown> = { file: null, auxColumns: [] as unknown[] };
  let top: BudgetLineItem | null = null;
  let group: BudgetLineItem | null = null;
  const TOP: Record<string, BudgetLineItem["kind"]> = { receitascorrentes: "receita", despesascorrentes: "despesa", constituicaodefundosfinanceiros: "fundo" };
  const num = (c: Cell) => (typeof c === "number" ? c : c === null || txt(c).trim() === "" ? null : Number(txt(c).replace(",", ".")));
  let pos = 0;
  s.rows.forEach((r, i) => {
    const name = cleanText(r[0]);
    const key = normalizeName(name);
    if (!name || ["rubrica", "orcamentopara" + year].includes(key) || /^ORÇAMENTO PARA/i.test(name)) return;
    if (key === "saldoorcamental") {
      sourceInfo.saldoOrcamental = { anual: num(r[2]), mensal: num(r[3]), trimestres: [8, 9, 10, 11].map((k) => num(r[k])), executado: num(r[13]) };
      return;
    }
    if (key === "disponibilidadesemcaixaebancos") {
      sourceInfo.disponibilidades = { inicial: num(r[2]), trimestres: [8, 9, 10, 11].map((k) => num(r[k])) };
      return;
    }
    const aux = r.slice(18).map(txt).filter(Boolean);
    if (aux.length) (sourceInfo.auxColumns as unknown[]).push({ row: i + 1, values: aux });
    const annualRaw = r[2] as number | string | null;
    if (annualRaw === null || annualRaw === undefined || txt(annualRaw) === "") return;
    const isUpper = name === name.toUpperCase() && /[A-Z]/.test(name);
    const quarters = [8, 9, 10, 11].map((k) => {
      const v = num(r[k]);
      return v === null || Number.isNaN(v) ? 0 : money(v);
    });
    const item: BudgetLineItem = {
      id: lineIdFor(year, name),
      row: i + 1,
      name,
      kind: "despesa",
      parentId: null,
      isGroup: isUpper,
      annual: money(num(annualRaw) ?? 0),
      annualRaw,
      monthlyRaw: r[3] as number | string | null,
      quotaShare: null,
      quarters,
      status: "novo",
      current: null,
    };
    if (TOP[key]) {
      item.kind = TOP[key];
      top = item;
      group = null;
    } else if (isUpper) {
      item.kind = top?.kind ?? "despesa";
      item.parentId = top?.id ?? null;
      group = item;
    } else {
      item.kind = top?.kind ?? "despesa";
      item.parentId = group?.id ?? top?.id ?? null;
      if (group && normalizeName(group.name) === "quotasordinarias") item.quotaShare = num(r[5]);
    }
    item.position = pos++;
    const executed = num(r[13]);
    const pending = num(r[15]);
    if ([...[8, 9, 10, 11].map((k) => num(r[k])), executed, pending].some((v) => v !== null && Number.isNaN(v))) divergences.push(`${name}: célula com valor não numérico — tratada como 0.`);
    const qsum = money(quarters.reduce((a, b) => a + b, 0));
    if (executed !== null && Math.abs(money(executed) - qsum) > 0.01) divergences.push(`${name}: executado anual (${money(executed)}) ≠ soma dos trimestres (${qsum}).`);
    if (pending !== null && Math.abs(money(item.annual - (executed ?? qsum)) - money(pending)) > 1) divergences.push(`${name}: "por executar" no ficheiro (${money(pending)}) ≠ orçamento − executado (${money(item.annual - (executed ?? qsum))}).`);
    if (typeof annualRaw === "number" && Math.abs(annualRaw - item.annual) > 0) divergences.push(`${name}: valor ${annualRaw} arredondado para ${item.annual}.`);
    if (!item.isGroup && item.annual === 0 && qsum > 0) divergences.push(`${name}: orçamento ≈ 0 mas executados ${qsum} — acima do orçamento.`);
    lines.push(item);
  });
  // grupos: o ficheiro tem valores próprios; o sistema usa a soma das folhas e assinala as diferenças
  for (const g of lines.filter((l) => l.isGroup)) {
    const leaves = (id: string): BudgetLineItem[] => lines.filter((l) => l.parentId === id).flatMap((l) => (l.isGroup ? leaves(l.id) : [l]));
    const ls = leaves(g.id);
    if (!ls.length) continue;
    const a = money(ls.reduce((x, l) => x + l.annual, 0));
    if (Math.abs(a - g.annual) > 0.01) divergences.push(`${g.name}: orçamento do grupo (${g.annual}) ≠ soma das sub-rubricas (${a}).`);
    [0, 1, 2, 3].forEach((q) => {
      const sq = money(ls.reduce((x, l) => x + l.quarters[q], 0));
      if (Math.abs(sq - g.quarters[q]) > 0.01) divergences.push(`${g.name} — ${q + 1}.º trimestre: valor do grupo (${g.quarters[q]}) ≠ soma das sub-rubricas (${sq}).`);
    });
  }
  divergences.push(
    "Fundo comum de reserva: os 14.400.000 Kz fazem parte das quotas ordinárias (receita) e voltam a aparecer em \"Constituição de fundos financeiros\"; o sistema mostra a constituição do fundo separadamente e não a soma às despesas correntes.",
  );
  if (lines.filter((l) => l.kind === "despesa" && !l.isGroup).every((l) => l.quarters.every((v) => v === 0))) divergences.push("Nenhuma rubrica de despesa tem execução registada no ficheiro — a execução de despesas será calculada a partir das despesas registadas no sistema.");
  if (budget) {
    for (const l of lines) {
      const cur = budget.lines.find((x) => x.id === l.id);
      if (!cur) continue;
      l.current = Number(cur.annualAmount);
      const curQ = [1, 2, 3, 4].map((q) => money(cur.executions.filter((e) => e.source === "ficheiro" && e.period === `${year}-T${q}`).reduce((a, e) => a + Number(e.amount), 0)));
      l.status = (l.isGroup || Math.abs(Number(cur.annualAmount) - l.annual) < 0.01) && (l.isGroup || curQ.every((v, q) => Math.abs(v - l.quarters[q]) < 0.01)) ? "igual" : "conflito";
    }
  }
  plan.budget = { year, exists: !!budget, lines, divergences, sourceInfo };
}

// ————————————————————————— pré-visualização —————————————————————————

export async function previewImport(sess: Session, fileIds: string[]): Promise<Plan> {
  requirePerm(sess, "data.import");
  const plan: Plan = { files: [], warnings: [] };
  for (const id of fileIds) {
    const f = await prisma.storedFile.findUnique({ where: { id } });
    if (!f || f.category !== "import") throw new ActionError("Ficheiro de importação inexistente.", 404);
    const sheets = await readWorkbook(await readFile(path.join(/* turbopackIgnore: true */ storageDir(), f.storagePath)));
    const kind = detect(sheets);
    plan.files.push({ fileId: id, name: f.originalName, kind, sheets: sheets.map((x) => x.name) });
    if (!kind) plan.warnings.push(`${f.originalName}: estrutura não reconhecida (fracções, mapa de gastos ou execução orçamental).`);
    try {
      if (kind === "fraccoes") await analyseFractions(sheets, plan);
      if (kind === "despesas") await analyseExpenses(sheets, plan);
      if (kind === "orcamento") await analyseBudget(sheets, plan);
    } catch (e) {
      throw new ActionError(`${f.originalName}: ${e instanceof Error ? e.message : "erro de leitura"}`, 422);
    }
    if (kind === "orcamento") plan.budget!.sourceInfo.file = f.originalName;
  }
  if (plan.expenses && plan.budget) {
    const names = new Map(plan.budget.lines.map((l) => [normalizeName(l.name), l.id]));
    plan.expenses.items.forEach((it) => {
      if (it.suggestedLineName && !names.has(normalizeName(it.suggestedLineName))) it.issues.push(`Rubrica sugerida "${it.suggestedLineName}" não existe no orçamento.`);
    });
  }
  return plan;
}

// ————————————————————————— cópia de segurança —————————————————————————

/** Cópia de segurança lógica (JSON comprimido) de todas as tabelas, antes de gravar. */
export async function jsonBackup(tx: Tx, label: string) {
  const models = Object.keys(prisma).filter((k) => !k.startsWith("$") && !k.startsWith("_") && typeof (tx as unknown as Record<string, { findMany?: unknown }>)[k]?.findMany === "function");
  const dump: Record<string, unknown> = { createdAt: new Date().toISOString(), label };
  for (const m of models) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (tx as any)[m].findMany();
    dump[m] = m === "user" ? rows.map((u: Record<string, unknown>) => ({ ...u, passwordHash: u.passwordHash ? "[omitido]" : null })) : m === "authSession" || m === "authToken" ? `[${rows.length} registos omitidos]` : rows;
  }
  const dir = path.resolve(/* turbopackIgnore: true */ process.env.BACKUP_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), "backups"));
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `antes-importacao-${new Date().toISOString().replace(/[:.]/g, "-")}.json.gz`);
  await writeFile(file, gzipSync(JSON.stringify(dump, (_, v) => (typeof v === "bigint" ? Number(v) : v))), { mode: 0o600 });
  return path.basename(file);
}

// ————————————————————————— aplicação —————————————————————————

export async function applyImport(sess: Session, fileIds: string[], d: Decisions) {
  requirePerm(sess, "data.import");
  const plan = await previewImport(sess, fileIds);
  const has = (list: string[] | undefined, v: string) => !!list?.includes(v);
  const report: Record<string, unknown> = { at: new Date().toISOString(), by: sess.name, files: plan.files.map((f) => ({ name: f.name, kind: f.kind })), decisions: d };

  return withWrite(
    async (tx) => {
      report.backup = await jsonBackup(tx, `importação Excel por ${sess.name}`);
      const by = { name: sess.name, role: sess.role };

      // ——— orçamento (primeiro: as despesas referenciam as rubricas) ———
      if (plan.budget) {
        const b = plan.budget;
        let budget = await tx.budget.findUnique({ where: { year: b.year } });
        if (!budget) {
          budget = await tx.budget.create({ data: { id: mid("bud"), year: b.year, name: `Orçamento ${b.year}`, status: "aprovado", source: String(b.sourceInfo.file ?? "Excel"), sourceInfo: JSON.stringify({ ...b.sourceInfo, divergences: b.divergences }), createdBy: sess.name } });
        } else {
          await tx.budget.update({ where: { id: budget.id }, data: { sourceInfo: JSON.stringify({ ...b.sourceInfo, divergences: b.divergences }) } });
        }
        const r = { linesCreated: 0, linesUpdated: 0, executionsCreated: 0, conflictsKept: 0 };
        for (const l of b.lines) {
          const data = {
            budgetId: budget.id,
            parentId: l.parentId,
            kind: l.kind,
            name: l.name,
            position: l.position ?? l.row,
            annualAmount: l.annual.toFixed(2),
            isGroup: l.isGroup,
            quotaShare: l.quotaShare !== null ? l.quotaShare.toFixed(4) : null,
            sourceRaw: JSON.stringify({ row: l.row, annual: l.annualRaw, monthly: l.monthlyRaw, quarters: l.quarters, file: b.sourceInfo.file }),
          };
          const exists = await tx.budgetLine.findUnique({ where: { id: l.id } });
          if (!exists) {
            await tx.budgetLine.create({ data: { id: l.id, ...data } });
            r.linesCreated++;
          } else if (l.status === "conflito") {
            if (!has(d.overwriteBudgetLines, l.id)) {
              r.conflictsKept++;
              continue;
            }
            await tx.budgetLine.update({ where: { id: l.id }, data });
            await tx.budgetExecution.deleteMany({ where: { lineId: l.id, source: "ficheiro" } });
            r.linesUpdated++;
          }
          // execução histórica do ficheiro apenas nas rubricas-folha (os grupos são calculados)
          if (!l.isGroup)
            for (const [q, v] of l.quarters.entries()) {
              if (!v) continue;
              const k = { lineId_period_source: { lineId: l.id, period: `${b.year}-T${q + 1}`, source: "ficheiro" } };
              if (await tx.budgetExecution.findUnique({ where: k })) continue;
              await tx.budgetExecution.create({ data: { id: mid("bex"), lineId: l.id, period: `${b.year}-T${q + 1}`, amount: v.toFixed(2), source: "ficheiro", note: `${b.sourceInfo.file} · linha ${l.row}`, createdBy: sess.name } });
              r.executionsCreated++;
            }
        }
        report.budget = { year: b.year, ...r, divergences: b.divergences };
        await auditLog(tx, by, "Orçamento importado", "budget", budget.id, `${b.year} · ${r.linesCreated} rubricas novas · ${r.executionsCreated} execuções`);
      }

      // ——— despesas e fornecedores ———
      if (plan.expenses) {
        const e = plan.expenses;
        const r = { suppliersCreated: 0, expensesCreated: 0, skippedDuplicates: 0, skippedByUser: 0, demoVoided: 0 };
        const lines = await tx.budgetLine.findMany({ select: { id: true, name: true } });
        const lineByName = new Map(lines.map((l) => [normalizeName(l.name), l.id]));
        const now = new Date().toISOString();
        for (const it of e.items) {
          if (it.duplicateOf) {
            r.skippedDuplicates++;
            continue;
          }
          if (d.skipExpenseRows?.includes(it.number)) {
            r.skippedByUser++;
            continue;
          }
          let sup = it.nif ? await tx.supplier.findFirst({ where: { nif: it.nif } }) : null;
          if (!sup) sup = (await tx.supplier.findMany()).find((x) => normalizeName(x.name) === normalizeName(it.supplierName)) ?? null;
          if (!sup) {
            const row = toRow("suppliers", { id: mid("sup"), name: it.supplierName, nif: it.nif ?? undefined, active: true, createdAt: now, history: [{ at: now, by: sess.name, text: `Registado na importação de ${plan.files.find((f) => f.kind === "despesas")?.name}.` }] });
            sup = await tx.supplier.create({ data: row as never });
            r.suppliersCreated++;
          }
          const chosen = d.expenseLines && it.number in d.expenseLines ? d.expenseLines[String(it.number)] : it.suggestedLineName ? lineByName.get(normalizeName(it.suggestedLineName)) ?? null : null;
          const date = it.paymentDate ?? it.invoiceDate ?? `${e.month ?? new Date().toISOString().slice(0, 7)}-01`;
          const id = mid("exp");
          const expense = {
            id,
            date,
            period: periodOf(date),
            category: it.category,
            description: it.description,
            amount: it.amount,
            supplierId: sup.id,
            supplierName: it.supplierName,
            nif: it.nif ?? undefined,
            invoiceRef: it.invoiceRef || undefined,
            invoiceDate: it.invoiceDate ?? undefined,
            paymentDate: it.paymentDate ?? undefined,
            vat: it.vat,
            withholding: it.withholding,
            netAmount: it.net,
            budgetLineId: chosen ?? undefined,
            status: it.paymentDate ? "paga" : "aprovada",
            paidAmount: it.paymentDate ? it.net : 0,
            payments: it.paymentDate ? [{ id: mid("xpp"), date: it.paymentDate, amount: it.net, by: sess.name, at: now }] : [],
            source: { file: plan.files.find((f) => f.kind === "despesas")?.name ?? "Excel", row: it.row, raw: it.raw },
            history: [{ at: now, by: sess.name, text: `Importada (linha ${it.row}, N.º ${it.number}).${it.issues.length ? ` Notas: ${it.issues.join(" ")}` : ""}` }],
            createdBy: sess.name,
            notes: it.issues.length ? it.issues.join(" ") : undefined,
          };
          await tx.expense.create({ data: toRow("expenses", expense) as never });
          r.expensesCreated++;
        }
        if (d.voidDemoSameMonth && e.demoSameMonth.length) {
          for (const x of e.demoSameMonth) {
            const cur = await tx.expense.findUnique({ where: { id: x.id } });
            if (!cur || cur.status === "anulada") continue;
            const hist = cur.history ? JSON.parse(cur.history) : [];
            await tx.expense.update({ where: { id: x.id }, data: { status: "anulada", voidReason: `Despesa de demonstração substituída pelo mapa real de ${e.month}.`, history: JSON.stringify([...hist, { at: now, by: sess.name, text: "Anulada na importação do mapa real." }]) } });
            r.demoVoided++;
          }
        }
        report.expenses = { month: e.month, totals: e.totals, ...r };
        await auditLog(tx, by, "Mapa de gastos importado", "expense", e.month ?? "excel", `${r.expensesCreated} despesas · ${r.suppliersCreated} fornecedores · ${r.skippedDuplicates} duplicadas ignoradas`);
      }

      // ——— fracções, proprietários e inquilinos ———
      if (plan.fractions) {
        const f = plan.fractions;
        const r = { partiesCreated: 0, ownersAssigned: 0, tenantsAssigned: 0, conflictsKept: 0, ownerNamesUpdated: 0, occupantsReplaced: 0, occupantsLinked: 0, rejected: 0 };
        // nomes a fundir (decisão explícita): o segundo passa a usar o registo do primeiro
        const alias = new Map<string, string>();
        for (const [a, b] of d.mergeNames ?? []) alias.set(normalizeName(b), a);
        const canonical = (name: string) => alias.get(normalizeName(name)) ?? name;
        // só cria o registo da pessoa/entidade quando vai ser efectivamente associado (sem registos órfãos)
        const resolve = async (name: string, role: string, item: FractionItem) => {
          const res = await findOrCreateParty(tx, { name: canonical(name) }, sess.name, { file: plan.files.find((x) => x.kind === "fraccoes")?.name, row: item.row, column: role, raw: role === "proprietario" ? item.owner.raw : item.tenant?.raw });
          if (res.created) r.partiesCreated++;
          return res.party;
        };
        const existing = (name: string) => tx.party.findFirst({ where: { normalizedName: normalizeName(canonical(name)), archived: false } });
        const today = new Date().toISOString().slice(0, 10);
        for (const it of f.items) {
          if (!it.apartmentId || it.issues.some((x) => /inexistente|inválido|repetida|em falta/.test(x))) {
            r.rejected++;
            continue;
          }
          const before = await tx.apartment.findUnique({ where: { id: it.apartmentId } });
          const assignOwner = it.ownerStatus === "novo" || (it.ownerStatus === "conflito" && has(d.replaceOwner, it.code));
          const owner = assignOwner || has(d.updateOwnerName, it.code) ? await resolve(it.owner.name, "proprietario", it) : await existing(it.owner.name);
          if (assignOwner && owner) {
            await assignHolderTx(tx, by, { apartmentId: it.apartmentId, role: "proprietario", partyId: owner.id, source: "importação Excel", notes: `Linha ${it.row}` });
            r.ownersAssigned++;
          } else if (it.ownerStatus === "conflito") r.conflictsKept++;
          // o nome do proprietário no cadastro só muda com decisão explícita
          const apt = await tx.apartment.findUnique({ where: { id: it.apartmentId } });
          if (apt && owner && has(d.updateOwnerName, it.code)) {
            if (before?.ownerName !== owner.name) r.ownerNamesUpdated++;
            await tx.apartment.update({ where: { id: apt.id }, data: { ownerName: owner.name } });
          } else if (apt && before && apt.ownerName !== before.ownerName) {
            await tx.apartment.update({ where: { id: apt.id }, data: { ownerName: before.ownerName } });
          }
          let tenant = null;
          if (it.tenant) {
            const assignTenant = it.tenantStatus === "novo" || (it.tenantStatus === "conflito" && has(d.replaceTenant, it.code));
            tenant = assignTenant || has(d.replaceOccupant, it.code) ? await resolve(it.tenant.name, "inquilino", it) : await existing(it.tenant.name);
            if (assignTenant && tenant) {
              await assignHolderTx(tx, by, { apartmentId: it.apartmentId, role: "inquilino", partyId: tenant.id, source: "importação Excel", notes: `Linha ${it.row}` });
              r.tenantsAssigned++;
            } else if (it.tenantStatus === "conflito") r.conflictsKept++;
          }
          // morador / ocupante
          const occupant = tenant ?? owner;
          if (!occupant) continue;
          if (it.occupantStatus === "conciliado" && apt?.residentId) {
            await tx.party.update({ where: { id: occupant.id }, data: { residentId: apt.residentId } });
            r.occupantsLinked++;
          } else if ((it.occupantStatus === "conflito" || it.occupantStatus === "sem_morador") && has(d.replaceOccupant, it.code) && apt) {
            const newId = mid("res");
            if (apt.residentId) {
              const old = await tx.resident.findUnique({ where: { id: apt.residentId } });
              await tx.resident.update({ where: { id: apt.residentId }, data: { status: "inactivo", apartmentId: null, notes: `${old?.notes ? `${old.notes}\n` : ""}Substituído por ${occupant.name} na importação Excel (${today}).` } });
              await tx.occupancy.updateMany({ where: { apartmentId: apt.id, residentId: apt.residentId, to: null }, data: { to: new Date(`${today}T00:00:00.000Z`) } });
            }
            await tx.resident.create({ data: { id: newId, name: occupant.name, email: "", phone: "", documentId: "", apartmentId: apt.id, type: tenant ? "inquilino" : "proprietario", status: "activo", since: new Date(`${today}T00:00:00.000Z`), dependents: "[]", notes: "Registado na importação Excel — completar contactos." } });
            await tx.occupancy.create({ data: { id: `occ_${newId}`, apartmentId: apt.id, residentId: newId, residentName: occupant.name, from: new Date(`${today}T00:00:00.000Z`) } });
            await tx.apartment.update({ where: { id: apt.id }, data: { residentId: newId, status: "ocupado" } });
            await tx.party.update({ where: { id: occupant.id }, data: { residentId: newId } });
            await auditLog(tx, by, "Ocupante substituído (importação)", "apartment", apt.id, `${it.currentResident ?? "—"} → ${occupant.name}`);
            r.occupantsReplaced++;
          }
        }
        report.fractions = r;
        await auditLog(tx, by, "Fracções importadas", "apartment", "excel", JSON.stringify(r));
      }

      await tx.importRun.create({ data: { source: "excel", by: sess.name, mode: "excel", summary: JSON.stringify({ ...report, warnings: plan.warnings }) } });
      return { report, warnings: plan.warnings };
    },
    { timeout: 180_000 },
  );
}

export async function listImportRuns(sess: Session) {
  requirePerm(sess, "data.import");
  const runs = await prisma.importRun.findMany({ orderBy: { at: "desc" }, take: 30 });
  return runs.map((r) => ({ id: r.id, at: r.at.toISOString(), by: r.by, source: r.source, mode: r.mode, summary: JSON.parse(r.summary) }));
}
