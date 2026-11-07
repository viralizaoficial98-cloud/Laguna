"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { apiJson } from "@/lib/api-client";
import { formatDateTime, formatKz } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";

/* tipos do plano devolvido pelo servidor (src/server/mgmt/excel-import.ts) */
interface FractionItem {
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
interface ExpenseItem {
  row: number;
  number: number;
  supplierName: string;
  nif: string | null;
  invoiceRef: string;
  invoiceDate: string | null;
  paymentDate: string | null;
  description: string;
  amount: number;
  vat: number;
  withholding: number;
  net: number;
  category: string;
  suggestedLineName: string | null;
  duplicateOf: string | null;
  issues: string[];
}
interface BudgetLineItem {
  id: string;
  row: number;
  name: string;
  kind: string;
  parentId: string | null;
  isGroup: boolean;
  annual: number;
  quotaShare: number | null;
  quarters: number[];
  status: "novo" | "igual" | "conflito";
  current: number | null;
}
interface Plan {
  files: { fileId: string; name: string; kind: string | null; sheets: string[] }[];
  fractions?: { items: FractionItem[]; possibleDuplicates: [string, string][]; owners: number; tenants: number; ownerOccupied: number };
  expenses?: { month: string | null; items: ExpenseItem[]; totals: { file: Record<string, number>; computed: Record<string, number>; reconciled: boolean }; suppliers: { name: string; nif: string | null; exists: boolean }[]; demoSameMonth: { id: string; description: string; amount: number }[] };
  budget?: { year: number; exists: boolean; lines: BudgetLineItem[]; divergences: string[] };
  warnings: string[];
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const ST: Record<string, [string, BadgeTone]> = {
  novo: ["Novo", "success"],
  igual: ["Igual", "neutral"],
  conflito: ["Conflito", "warning"],
  sem_inquilino: ["Sem inquilino", "neutral"],
  conciliado: ["Conciliado", "success"],
  sem_morador: ["Sem morador", "info"],
  bloqueado_conta: ["Conta associada", "violet"],
};
const B = ({ s }: { s: string }) => <Badge tone={ST[s]?.[1] ?? "neutral"}>{ST[s]?.[0] ?? s}</Badge>;

export function ExcelImport() {
  const ref = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [tab, setTab] = useState<"fraccoes" | "despesas" | "orcamento">("fraccoes");
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  // decisões explícitas
  const [updateOwnerName, setUpdateOwnerName] = useState<Set<string>>(new Set());
  const [replaceOccupant, setReplaceOccupant] = useState<Set<string>>(new Set());
  const [replaceOwner, setReplaceOwner] = useState<Set<string>>(new Set());
  const [replaceTenant, setReplaceTenant] = useState<Set<string>>(new Set());
  const [merges, setMerges] = useState<Set<string>>(new Set());
  const [skipRows, setSkipRows] = useState<Set<number>>(new Set());
  const [lineChoice, setLineChoice] = useState<Record<string, string | null>>({});
  const [voidDemo, setVoidDemo] = useState(false);
  const [overwriteLines, setOverwriteLines] = useState<Set<string>>(new Set());
  const { data: runs, reload: reloadRuns } = useApi<{ runs: { id: number; at: string; by: string; source: string; summary: Record<string, unknown> }[] }>("/api/excel-import/runs");
  const { data: budgetNow } = useApi<{ lines: { id: string; name: string; kind: string; isGroup: boolean }[] }>(plan?.expenses && !plan.budget ? `/api/budget?year=${(plan.expenses.month ?? String(new Date().getFullYear())).slice(0, 4)}` : null);

  const lineOptions = useMemo(() => (plan?.budget?.lines ?? budgetNow?.lines ?? []).filter((l) => !l.isGroup && l.kind === "despesa").map((l) => ({ id: l.id, name: l.name })), [plan, budgetNow]);
  const suggested = (it: ExpenseItem) => (it.suggestedLineName ? lineOptions.find((o) => norm(o.name) === norm(it.suggestedLineName!))?.id ?? "" : "");

  const preview = async () => {
    if (!files.length) return toast.error("Seleccione os ficheiros Excel (.xlsx).");
    setBusy(true);
    setReport(null);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      const res = await fetch("/api/excel-import/preview", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setFileIds(json.fileIds);
      setPlan(json.plan);
      setTab(json.plan.fractions ? "fraccoes" : json.plan.expenses ? "despesas" : "orcamento");
      setConfirmed(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na leitura.");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!plan || !confirmed) return;
    setBusy(true);
    try {
      const decisions = {
        updateOwnerName: [...updateOwnerName],
        replaceOccupant: [...replaceOccupant],
        replaceOwner: [...replaceOwner],
        replaceTenant: [...replaceTenant],
        mergeNames: [...merges].map((k) => k.split("||") as [string, string]),
        skipExpenseRows: [...skipRows],
        expenseLines: lineChoice,
        voidDemoSameMonth: voidDemo,
        overwriteBudgetLines: [...overwriteLines],
      };
      const r = await apiJson<{ report: Record<string, unknown> }>("/api/excel-import/apply", { method: "POST", json: { fileIds, decisions, confirm: true } });
      setReport(r.report);
      setPlan(null);
      reloadRuns();
      toast.success("Importação concluída — relatório gerado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "A importação falhou — nada foi gravado.", { duration: 8000 });
    } finally {
      setBusy(false);
    }
  };

  const toggle = <T,>(set: Set<T>, setter: (s: Set<T>) => void, v: T) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    setter(n);
  };
  const all = <T,>(items: T[], set: Set<T>, setter: (s: Set<T>) => void) => setter(items.every((i) => set.has(i)) ? new Set() : new Set(items));

  const fr = plan?.fractions;
  const ex = plan?.expenses;
  const bu = plan?.budget;
  const occCodes = fr?.items.filter((i) => i.occupantStatus === "conflito" || i.occupantStatus === "sem_morador").map((i) => i.code) ?? [];
  const nameCodes = fr?.items.map((i) => i.code) ?? [];
  const ownerConf = fr?.items.filter((i) => i.ownerStatus === "conflito").map((i) => i.code) ?? [];
  const tenantConf = fr?.items.filter((i) => i.tenantStatus === "conflito").map((i) => i.code) ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="1. Ficheiros Excel" description="Fracções/proprietários/inquilinos, mapa mensal de gastos e execução orçamental. A leitura não grava nada." action={<FileSpreadsheet className="h-4 w-4 text-graphite-400" />} />
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input ref={ref} type="file" multiple accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" data-testid="excel-files" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          <Button variant="outline" onClick={() => ref.current?.click()}>
            <Upload className="h-4 w-4" /> Seleccionar ficheiros
          </Button>
          <span className="text-sm text-graphite-600">{files.length ? files.map((f) => f.name).join(" · ") : "Nenhum ficheiro seleccionado"}</span>
          <Button className="sm:ml-auto" onClick={() => void preview()} loading={busy} disabled={!files.length}>
            Ler e pré-visualizar
          </Button>
        </CardBody>
      </Card>

      {plan && (
        <Card data-testid="excel-plan">
          <CardHeader title="2. Pré-visualização e decisões" description={plan.files.map((f) => `${f.name} → ${f.kind ?? "não reconhecido"}`).join(" · ")} />
          <CardBody className="space-y-4">
            {plan.warnings.map((w) => (
              <p key={w} className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w}
              </p>
            ))}
            <Tabs
              className="w-fit max-w-full"
              value={tab}
              onChange={setTab}
              tabs={[...(fr ? [{ id: "fraccoes" as const, label: `Fracções (${fr.items.length})` }] : []), ...(ex ? [{ id: "despesas" as const, label: `Despesas (${ex.items.length})` }] : []), ...(bu ? [{ id: "orcamento" as const, label: `Orçamento ${bu.year} (${bu.lines.length})` }] : [])]}
            />

            {tab === "fraccoes" && fr && (
              <>
                <p className="text-sm text-graphite-600">
                  {fr.owners} proprietários distintos · {fr.tenants} inquilinos distintos · {fr.ownerOccupied} fracções em que o Nome Fiscal coincide com o proprietário (sem inquilino). Proprietários e inquilinos novos são associados; nada existente é substituído sem
                  a sua decisão.
                </p>
                {fr.possibleDuplicates.length > 0 && (
                  <div className="rounded-xl border border-amber-200 p-3 text-sm">
                    <p className="mb-2 font-medium text-amber-900">Possíveis duplicados — marque os que são a mesma pessoa/entidade (mantém-se o primeiro nome):</p>
                    {fr.possibleDuplicates.map(([a, b]) => (
                      <label key={a + b} className="flex items-center gap-2">
                        <input type="checkbox" checked={merges.has(`${a}||${b}`)} onChange={() => toggle(merges, setMerges, `${a}||${b}`)} /> {a} <span className="text-graphite-400">≈</span> {b}
                      </label>
                    ))}
                  </div>
                )}
                <div className="scrollbar-thin max-h-[520px] overflow-auto">
                  <table className="w-full min-w-[1100px] text-xs" data-testid="fractions-plan">
                    <thead className="sticky top-0 bg-graphite-50">
                      <tr className="text-[10px] tracking-wider text-graphite-500 uppercase">
                        <th className="px-2 py-2 text-left">Fracção</th>
                        <th className="px-2 py-2 text-left">Proprietário (Nome)</th>
                        <th className="px-2 py-2 text-left">Inquilino (Nome Fiscal)</th>
                        <th className="px-2 py-2 text-left">Cadastro actual</th>
                        <th className="px-2 py-2 text-left">Ocupante actual</th>
                        <th className="px-2 py-2">
                          <label className="flex flex-col items-center gap-1">
                            Actualizar nome
                            <input type="checkbox" aria-label="Actualizar todos os nomes" checked={nameCodes.length > 0 && nameCodes.every((c) => updateOwnerName.has(c))} onChange={() => all(nameCodes, updateOwnerName, setUpdateOwnerName)} />
                          </label>
                        </th>
                        <th className="px-2 py-2">
                          <label className="flex flex-col items-center gap-1">
                            Substituir ocupante
                            <input type="checkbox" aria-label="Substituir todos os ocupantes" checked={occCodes.length > 0 && occCodes.every((c) => replaceOccupant.has(c))} onChange={() => all(occCodes, replaceOccupant, setReplaceOccupant)} />
                          </label>
                        </th>
                        {(ownerConf.length > 0 || tenantConf.length > 0) && <th className="px-2 py-2">Substituir titular</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-graphite-100">
                      {fr.items.map((i) => (
                        <tr key={i.code} className={i.issues.some((x) => /inexistente|inválido|repetida|em falta/.test(x)) ? "bg-red-50" : ""}>
                          <td className="px-2 py-1.5 font-semibold text-navy-900">{i.code}</td>
                          <td className="px-2 py-1.5">
                            {i.owner.name} <B s={i.ownerStatus} />
                            {i.ownerStatus === "conflito" && <span className="block text-[10px] text-amber-700">actual: {i.currentOwner}</span>}
                          </td>
                          <td className="px-2 py-1.5">
                            {i.tenant ? i.tenant.name : <span className="text-graphite-400">{i.ownerOccupied ? "— (proprietário ocupante)" : "—"}</span>} {i.tenant && <B s={i.tenantStatus} />}
                            {i.tenantStatus === "conflito" && <span className="block text-[10px] text-amber-700">actual: {i.currentTenant}</span>}
                          </td>
                          <td className="px-2 py-1.5 text-graphite-600">{i.cadastreOwnerName ?? "—"}</td>
                          <td className="px-2 py-1.5 text-graphite-600">
                            {i.currentResident ?? "—"} <B s={i.occupantStatus} />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <input type="checkbox" aria-label={`Actualizar nome ${i.code}`} checked={updateOwnerName.has(i.code)} onChange={() => toggle(updateOwnerName, setUpdateOwnerName, i.code)} />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {i.occupantStatus === "conflito" || i.occupantStatus === "sem_morador" ? (
                              <input type="checkbox" aria-label={`Substituir ocupante ${i.code}`} checked={replaceOccupant.has(i.code)} onChange={() => toggle(replaceOccupant, setReplaceOccupant, i.code)} />
                            ) : i.occupantStatus === "bloqueado_conta" ? (
                              <span className="text-[10px] text-graphite-400" title="Morador com conta no portal — gerir manualmente">protegido</span>
                            ) : null}
                          </td>
                          {(ownerConf.length > 0 || tenantConf.length > 0) && (
                            <td className="px-2 py-1.5 text-center text-[10px]">
                              {i.ownerStatus === "conflito" && (
                                <label className="block">
                                  <input type="checkbox" checked={replaceOwner.has(i.code)} onChange={() => toggle(replaceOwner, setReplaceOwner, i.code)} /> proprietário
                                </label>
                              )}
                              {i.tenantStatus === "conflito" && (
                                <label className="block">
                                  <input type="checkbox" checked={replaceTenant.has(i.code)} onChange={() => toggle(replaceTenant, setReplaceTenant, i.code)} /> inquilino
                                </label>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-graphite-500">“Substituir ocupante”: o morador actual passa a inactivo (histórico preservado) e é criado o registo do inquilino — ou do proprietário, se não houver inquilino. Moradores com conta no portal nunca são substituídos automaticamente.</p>
              </>
            )}

            {tab === "despesas" && ex && (
              <>
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4" data-testid="expenses-totals">
                  {(["valor", "iva", "retencao", "liquido"] as const).map((k) => (
                    <div key={k} className="rounded-xl border border-graphite-100 p-3">
                      <p className="text-[11px] text-graphite-500 uppercase">{{ valor: "Despesas", iva: "IVA", retencao: "Retenção", liquido: "Líquido pago" }[k]}</p>
                      <p className="font-semibold tabular-nums">{formatKz(ex.totals.computed[k])}</p>
                      <p className={`text-[11px] ${Math.abs((ex.totals.file[k] ?? 0) - ex.totals.computed[k]) < 0.01 ? "text-emerald-700" : "text-red-700"}`}>ficheiro: {formatKz(ex.totals.file[k] ?? 0)}</p>
                    </div>
                  ))}
                </div>
                <p className={`text-sm ${ex.totals.reconciled ? "text-emerald-800" : "text-red-700"}`}>{ex.totals.reconciled ? "✓ Os totais das linhas coincidem com os totais do ficheiro." : "Os totais não coincidem — valores mantidos, a validar."}</p>
                {ex.demoSameMonth.length > 0 && (
                  <label className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                    <input type="checkbox" checked={voidDemo} onChange={(e) => setVoidDemo(e.target.checked)} className="mt-1" />
                    Anular as {ex.demoSameMonth.length} despesas de demonstração de {ex.month} ({formatKz(ex.demoSameMonth.reduce((a, d) => a + d.amount, 0))}) para não somarem às reais. São anuladas, não apagadas.
                  </label>
                )}
                <div className="scrollbar-thin max-h-[520px] overflow-auto">
                  <table className="w-full min-w-[1100px] text-xs">
                    <thead className="sticky top-0 bg-graphite-50">
                      <tr className="text-[10px] tracking-wider text-graphite-500 uppercase">
                        <th className="px-2 py-2">Importar</th>
                        <th className="px-2 py-2 text-left">N.º</th>
                        <th className="px-2 py-2 text-left">Fornecedor · NIF</th>
                        <th className="px-2 py-2 text-left">Factura · datas</th>
                        <th className="px-2 py-2 text-left">Descrição</th>
                        <th className="px-2 py-2 text-right">Valor</th>
                        <th className="px-2 py-2 text-right">IVA</th>
                        <th className="px-2 py-2 text-right">Ret.</th>
                        <th className="px-2 py-2 text-right">Líquido</th>
                        <th className="px-2 py-2 text-left">Rubrica (sugerida)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-graphite-100">
                      {ex.items.map((it) => (
                        <tr key={it.number} className={it.duplicateOf ? "bg-graphite-50 text-graphite-400" : it.issues.length ? "bg-amber-50/50" : ""}>
                          <td className="px-2 py-1.5 text-center">{it.duplicateOf ? <span title={it.issues.join(" ")}>já existe</span> : <input type="checkbox" checked={!skipRows.has(it.number)} onChange={() => toggle(skipRows, setSkipRows, it.number)} aria-label={`Importar linha ${it.number}`} />}</td>
                          <td className="px-2 py-1.5">{it.number}</td>
                          <td className="px-2 py-1.5">
                            {it.supplierName}
                            <span className="block text-[10px] text-graphite-500">{it.nif ?? "sem NIF"}</span>
                          </td>
                          <td className="px-2 py-1.5">
                            {it.invoiceRef}
                            <span className="block text-[10px] text-graphite-500">
                              {it.invoiceDate ?? "—"} → pago {it.paymentDate ?? "—"}
                            </span>
                          </td>
                          <td className="px-2 py-1.5">
                            {it.description}
                            {it.issues.length > 0 && <span className="block text-[10px] text-amber-800">{it.issues.join(" ")}</span>}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{formatKz(it.amount)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{formatKz(it.vat)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{formatKz(it.withholding)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{formatKz(it.net)}</td>
                          <td className="px-2 py-1.5">
                            <Select className="h-8 min-w-48 text-xs" value={lineChoice[String(it.number)] ?? suggested(it)} onChange={(e) => setLineChoice({ ...lineChoice, [String(it.number)]: e.target.value || null })} aria-label={`Rubrica linha ${it.number}`}>
                              <option value="">Por classificar</option>
                              {lineOptions.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                            </Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {tab === "orcamento" && bu && (
              <>
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900">
                  <p className="mb-1 font-medium">Divergências no ficheiro (valores originais mantidos):</p>
                  <ul className="list-disc space-y-0.5 pl-5 text-xs">
                    {bu.divergences.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
                <div className="scrollbar-thin max-h-[520px] overflow-auto">
                  <table className="w-full min-w-[820px] text-xs">
                    <thead className="sticky top-0 bg-graphite-50">
                      <tr className="text-[10px] tracking-wider text-graphite-500 uppercase">
                        <th className="px-2 py-2 text-left">Rubrica</th>
                        <th className="px-2 py-2 text-right">Orçamento</th>
                        {[1, 2, 3, 4].map((q) => (
                          <th key={q} className="px-2 py-2 text-right">
                            Exec. T{q}
                          </th>
                        ))}
                        <th className="px-2 py-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-graphite-100">
                      {bu.lines.map((l) => (
                        <tr key={l.id} className={l.isGroup ? "bg-graphite-50 font-semibold" : ""}>
                          <td className="px-2 py-1.5" style={{ paddingLeft: 8 + (l.parentId ? (bu.lines.find((x) => x.id === l.parentId)?.parentId ? 32 : 16) : 0) }}>
                            {l.name}
                            {l.quotaShare ? <span className="ml-1 font-normal text-graphite-500">({Math.round(l.quotaShare * 100)}%)</span> : null}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{formatKz(l.annual)}</td>
                          {l.quarters.map((v, i) => (
                            <td key={i} className="px-2 py-1.5 text-right tabular-nums">
                              {v ? formatKz(v) : "—"}
                            </td>
                          ))}
                          <td className="px-2 py-1.5 text-center">
                            <B s={l.status} />
                            {l.status === "conflito" && (
                              <label className="mt-1 block text-[10px]">
                                <input type="checkbox" checked={overwriteLines.has(l.id)} onChange={() => toggle(overwriteLines, setOverwriteLines, l.id)} /> substituir
                              </label>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-graphite-500">A execução do ficheiro é guardada apenas nas rubricas-folha (os grupos são calculados), identificada como “origem: ficheiro”.</p>
              </>
            )}

            <div className="space-y-3 border-t border-graphite-100 pt-4">
              <p className="text-xs text-graphite-500">Antes de gravar é criada automaticamente uma cópia de segurança da base de dados (JSON comprimido). A importação nunca elimina registos e não duplica dados já importados.</p>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} data-testid="excel-confirm" />
                Revi a pré-visualização e confirmo a importação com as decisões indicadas.
              </label>
              <Button onClick={() => void apply()} disabled={!confirmed || busy} loading={busy}>
                Importar para a base de dados
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {report && (
        <Card data-testid="excel-report">
          <CardHeader title="3. Relatório de importação" action={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} />
          <CardBody className="space-y-2 text-sm">
            <p>Cópia de segurança: {String(report.backup)}</p>
            {report.budget ? <p>Orçamento: {summ(report.budget)}</p> : null}
            {report.expenses ? <p>Despesas: {summ(report.expenses)}</p> : null}
            {report.fractions ? <p>Fracções: {summ(report.fractions)}</p> : null}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Importações anteriores" />
        <ul className="divide-y divide-graphite-100 text-sm">
          {(runs?.runs ?? []).map((r) => (
            <li key={r.id} className="px-5 py-2.5">
              <span className="text-xs text-graphite-400">{formatDateTime(r.at)}</span> · <strong>{r.by}</strong> · {r.source}
              <span className="block text-xs text-graphite-600">{["budget", "expenses", "fractions", "inserted"].filter((k) => k in r.summary).map((k) => `${k}: ${typeof r.summary[k] === "object" ? summ(r.summary[k]) : String(r.summary[k])}`).join(" · ")}</span>
            </li>
          ))}
          {!(runs?.runs ?? []).length && <li className="px-5 py-4 text-xs text-graphite-400">Sem importações.</li>}
        </ul>
      </Card>
    </div>
  );
}

const LABELS: Record<string, string> = {
  linesCreated: "rubricas criadas",
  linesUpdated: "rubricas actualizadas",
  executionsCreated: "execuções",
  conflictsKept: "conflitos mantidos",
  suppliersCreated: "fornecedores novos",
  expensesCreated: "despesas importadas",
  skippedDuplicates: "duplicadas ignoradas",
  skippedByUser: "excluídas",
  demoVoided: "demonstração anuladas",
  partiesCreated: "titulares novos",
  ownersAssigned: "proprietários associados",
  tenantsAssigned: "inquilinos associados",
  ownerNamesUpdated: "nomes actualizados",
  occupantsReplaced: "ocupantes substituídos",
  occupantsLinked: "ocupantes conciliados",
  rejected: "rejeitadas",
};
function summ(o: unknown) {
  if (!o || typeof o !== "object") return String(o);
  return Object.entries(o as Record<string, unknown>)
    .filter(([k, v]) => k in LABELS && typeof v === "number")
    .map(([k, v]) => `${v} ${LABELS[k]}`)
    .join(" · ");
}
