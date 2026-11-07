"use client";

import { AlertTriangle, FileDown, FileSpreadsheet, Landmark, Pencil, PiggyBank, Plus, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { useSession } from "@/hooks/use-session";
import { can } from "@/config/permissions";
import { apiJson } from "@/lib/api-client";
import { downloadXlsx } from "@/lib/excel-export";
import { cn, formatKz } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { IconBtn } from "@/components/ui/icon-button";
import { GroupedBars } from "@/components/charts/charts";

interface Line {
  id: string;
  parentId: string | null;
  kind: string;
  name: string;
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
type Tot = { annual: number; executed: number; file: number; system: number; overlapping: number };
interface BudgetResp {
  budget: { id: string; year: number; name: string; status: string; source: string | null; sourceInfo: { divergences?: string[]; disponibilidades?: { inicial: number | null; trimestres: (number | null)[] }; file?: string } | null } | null;
  lines: Line[];
  totals: { revenue: Tot; expense: Tot; fund: Tot; balanceBudget: number; balanceExecuted: number } | null;
  years: number[];
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const KIND: Record<string, string> = { receita: "Receitas", despesa: "Despesas", fundo: "Fundos" };

export default function OrcamentoPage() {
  const session = useSession();
  const manage = can(session?.role, "budget.manage");
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, reload } = useApi<BudgetResp>(`/api/budget?year=${year}`);
  const [view, setView] = useState<"anual" | "trimestral" | "mensal">("anual");
  const [kind, setKind] = useState<"todas" | "receita" | "despesa" | "fundo">("todas");
  const [edit, setEdit] = useState<Line | null>(null);
  const [adding, setAdding] = useState<Line | null>(null);
  const [del, setDel] = useState<Line | null>(null);
  const b = data?.budget;
  const t = data?.totals;
  const lines = (data?.lines ?? []).filter((l) => kind === "todas" || l.kind === kind);
  const q = (l: Line, n: number) => {
    const k = `${year}-T${n}`;
    return { file: l.file[k] ?? 0, system: l.system[k] ?? 0 };
  };

  const exportXlsx = () =>
    downloadXlsx(`mapa-orcamental-${year}.xlsx`, [
      {
        name: `Execução ${year}`,
        head: ["Tipo", "Rubrica", "Orçamento anual", "Orçamento mensal", "T1 ficheiro", "T2 ficheiro", "T3 ficheiro", "T4 ficheiro", "T1 sistema", "T2 sistema", "T3 sistema", "T4 sistema", "Executado", "Desvio", "Desvio %", "Disponível"],
        rows: (data?.lines ?? []).map((l) => [KIND[l.kind], `${"  ".repeat(l.depth)}${l.name}`, l.annual, Math.round((l.annual / 12) * 100) / 100, ...[1, 2, 3, 4].map((n) => q(l, n).file), ...[1, 2, 3, 4].map((n) => q(l, n).system), l.executed, l.deviation, l.deviationPct ?? "", l.available]),
        money: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15],
      },
      { name: "Divergências", head: ["Divergência do ficheiro de origem"], rows: (b?.sourceInfo?.divergences ?? []).map((d) => [d]) },
    ]);

  const exportPdf = async () => {
    if (!t) return;
    const { downloadReportPdf } = await import("@/lib/report-pdf");
    const groups = (data?.lines ?? []).filter((l) => l.kind === "despesa" && l.depth === 1);
    await downloadReportPdf({
      title: `Mapa Orçamental ${year}`,
      subtitle: "Orçamento aprovado, execução histórica (ficheiro) e movimentos do sistema",
      period: `Ano ${year}`,
      author: `${session?.name ?? ""} — ${session?.title ?? ""}`,
      fileName: `Mapa_Orcamental_${year}.pdf`,
      kpis: [
        { label: "Receitas orçadas", value: formatKz(t.revenue.annual) },
        { label: "Receitas executadas", value: formatKz(t.revenue.executed) },
        { label: "Despesas orçadas", value: formatKz(t.expense.annual) },
        { label: "Despesas executadas", value: formatKz(t.expense.executed) },
        { label: "Fundo de reserva (executado)", value: formatKz(t.fund.executed) },
        { label: "Saldo executado", value: formatKz(t.balanceExecuted) },
      ],
      charts: [{ title: "Despesas por grupo — orçamento vs executado", categories: groups.map((g) => g.name.slice(0, 22)), series: [{ label: "Orçamento", values: groups.map((g) => g.annual) }, { label: "Executado", values: groups.map((g) => g.executed) }], unit: "kz" }],
      summary: [`Execução da receita: ${t.revenue.annual ? ((t.revenue.executed / t.revenue.annual) * 100).toFixed(1) : 0}% · execução da despesa: ${t.expense.annual ? ((t.expense.executed / t.expense.annual) * 100).toFixed(1) : 0}%.`, "Totais calculados a partir das rubricas-folha (sem dupla contabilização). A execução histórica do ficheiro prevalece nos trimestres em que existe."],
      pending: (data?.lines ?? []).filter((l) => l.over && !l.isGroup).map((l) => `${l.name}: executado ${formatKz(l.executed)} acima do orçamento ${formatKz(l.annual)}`),
      recommendations: (b?.sourceInfo?.divergences ?? []).slice(0, 8),
      tables: [{ title: "Execução por rubrica", head: ["Rubrica", "Orçamento", "Executado", "Desvio", "%"], rows: (data?.lines ?? []).map((l) => [`${"· ".repeat(l.depth)}${l.name}`, formatKz(l.annual), formatKz(l.executed), formatKz(l.deviation), l.deviationPct === null ? "—" : `${l.deviationPct}%`]) }],
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="Gestão Financeira"
        title="Orçamento e Execução"
        description="Orçamento aprovado, execução histórica importada do ficheiro de origem e movimentos do sistema (despesas por rubrica, receitas registadas e quotas recebidas) — sempre identificados separadamente."
        actions={
          <div className="flex flex-wrap gap-2">
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Ano" className="w-28">
              {Array.from(new Set([...(data?.years ?? []), year, new Date().getFullYear()]))
                .sort()
                .map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
            </Select>
            <Button variant="outline" onClick={() => void exportXlsx()} disabled={!b}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" onClick={() => void exportPdf()} disabled={!b}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />
      {data && !b && (
        <Card>
          <CardBody className="text-sm">
            Ainda não existe orçamento para {year}. Importe o ficheiro “Execução Orçamental” em{" "}
            <Link href="/painel/importacao" className="font-medium text-navy-700 underline">
              Importação de dados
            </Link>
            .
          </CardBody>
        </Card>
      )}
      {b && t && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="budget-totals">
            <StatCard index={0} highlight label="Receitas orçadas" value={formatKz(t.revenue.annual)} icon={PiggyBank} hint={`executado ${formatKz(t.revenue.executed)}`} />
            <StatCard index={1} label="Despesas orçadas" value={formatKz(t.expense.annual)} icon={Wallet} tone="info" hint={`executado ${formatKz(t.expense.executed)}`} />
            <StatCard index={2} label="Orçamento disponível (despesas)" value={formatKz(t.expense.annual - t.expense.executed)} icon={Landmark} tone="success" hint={`${t.expense.annual ? ((t.expense.executed / t.expense.annual) * 100).toFixed(1) : 0}% executado`} />
            <StatCard index={3} label="Fundo comum de reserva" value={formatKz(t.fund.executed)} icon={Landmark} tone="gold" hint={`orçado ${formatKz(t.fund.annual)} · não somado às despesas`} />
          </div>
          <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Execução por grupo de despesa" description="Orçamento anual vs executado" />
              <CardBody>
                <GroupedBars data={(data?.lines ?? []).filter((l) => l.kind === "despesa" && l.depth === 1).map((l) => ({ label: l.name.replace(/ E | DE /g, " ").slice(0, 20), orcamento: l.annual, executado: l.executed }))} series={[{ key: "orcamento", label: "Orçamento" }, { key: "executado", label: "Executado" }]} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Origem da execução" description="O ficheiro de origem prevalece nos trimestres em que tem dados" />
              <CardBody className="space-y-2 text-sm">
                {(["revenue", "expense", "fund"] as const).map((k) => (
                  <div key={k} className="flex flex-wrap justify-between gap-2 border-b border-graphite-100 pb-2">
                    <span className="font-medium text-navy-900">{{ revenue: "Receitas", expense: "Despesas", fund: "Fundos" }[k]}</span>
                    <span className="text-xs text-graphite-600">
                      Ficheiro {formatKz(t[k].file)} · Sistema {formatKz(t[k].system)} · <strong>Considerado {formatKz(t[k].executed)}</strong>
                      {t[k].overlapping ? ` · ${t[k].overlapping} rubrica(s) com sobreposição a validar` : ""}
                    </span>
                  </div>
                ))}
                {b.sourceInfo?.disponibilidades && (
                  <p className="text-xs text-graphite-500">
                    Disponibilidades em caixa e bancos (ficheiro): inicial {formatKz(b.sourceInfo.disponibilidades.inicial ?? 0)} · {b.sourceInfo.disponibilidades.trimestres.map((v, i) => `T${i + 1} ${formatKz(v ?? 0)}`).join(" · ")}
                  </p>
                )}
              </CardBody>
            </Card>
          </div>
          {(b.sourceInfo?.divergences ?? []).length > 0 && (
            <details className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm">
              <summary className="flex cursor-pointer items-center gap-2 font-medium text-amber-900">
                <AlertTriangle className="h-4 w-4" /> {b.sourceInfo!.divergences!.length} divergências no ficheiro de origem ({b.sourceInfo?.file ?? b.source}) — valores mantidos, a validar
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-amber-900">
                {b.sourceInfo!.divergences!.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </details>
          )}
          <Card>
            <div className="flex flex-col gap-3 border-b border-graphite-100 p-3 sm:flex-row sm:items-center sm:justify-between">
              <Tabs value={view} onChange={setView} tabs={[{ id: "anual", label: "Anual" }, { id: "trimestral", label: "Trimestral" }, { id: "mensal", label: "Mensal" }]} />
              <Tabs value={kind} onChange={setKind} tabs={[{ id: "todas", label: "Todas" }, { id: "receita", label: "Receitas" }, { id: "despesa", label: "Despesas" }, { id: "fundo", label: "Fundos" }]} />
            </div>
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm" data-testid="budget-table">
                <thead>
                  <tr className="border-b border-graphite-100 bg-graphite-50/70 text-[11px] tracking-wider text-graphite-500 uppercase">
                    <th className="px-3 py-2.5 text-left">Rubrica</th>
                    <th className="px-3 py-2.5 text-right">Orçamento</th>
                    {view === "trimestral" && [1, 2, 3, 4].map((n) => <th key={n} className="px-3 py-2.5 text-right">T{n}</th>)}
                    {view === "mensal" && MONTHS.map((m) => <th key={m} className="px-2 py-2.5 text-right">{m}</th>)}
                    {view !== "mensal" && (
                      <>
                        <th className="px-3 py-2.5 text-right">Executado</th>
                        <th className="px-3 py-2.5 text-right">Desvio</th>
                        <th className="px-3 py-2.5 text-right">%</th>
                        <th className="px-3 py-2.5 text-right">Disponível</th>
                      </>
                    )}
                    {manage && <th />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-graphite-100">
                  {lines.map((l) => (
                    <Fragment key={l.id}>
                      <tr className={cn(l.isGroup ? "bg-graphite-50/60 font-semibold text-navy-900" : "text-graphite-800", l.over && "bg-red-50/60")}>
                        <td className="px-3 py-2" style={{ paddingLeft: 12 + l.depth * 18 }}>
                          {l.name}
                          {l.quotaShare ? <span className="ml-1 text-[11px] font-normal text-graphite-500">({Math.round(l.quotaShare * 100)}% das quotas)</span> : null}
                          {l.over && <span className="ml-2 text-[11px] font-medium text-red-700">acima do orçamento</span>}
                          {l.overlap.length > 0 && <span className="ml-2 text-[11px] text-amber-700">sobreposição {l.overlap.join(", ")}</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatKz(l.annual)}</td>
                        {view === "trimestral" &&
                          [1, 2, 3, 4].map((n) => {
                            const v = q(l, n);
                            return (
                              <td key={n} className="px-3 py-2 text-right text-xs tabular-nums">
                                {v.file ? <span title="Execução histórica (ficheiro)">{formatKz(v.file)}</span> : null}
                                {v.system ? <span className="block text-sky-700" title="Movimentos do sistema">{formatKz(v.system)} sist.</span> : null}
                                {!v.file && !v.system ? "—" : null}
                              </td>
                            );
                          })}
                        {view === "mensal" &&
                          l.monthly.map((m, i) => (
                            <td key={i} className="px-2 py-2 text-right text-[11px] tabular-nums">
                              {formatKz(m).replace(" Kz", "")}
                              {l.systemMonthly[i] ? <span className="block text-sky-700">{formatKz(l.systemMonthly[i]).replace(" Kz", "")}</span> : null}
                            </td>
                          ))}
                        {view !== "mensal" && (
                          <>
                            <td className="px-3 py-2 text-right tabular-nums">{formatKz(l.executed)}</td>
                            <td className={cn("px-3 py-2 text-right tabular-nums", l.deviation > 0 && l.kind !== "receita" ? "text-red-700" : "")}>{formatKz(l.deviation)}</td>
                            <td className="px-3 py-2 text-right text-xs">{l.deviationPct === null ? "—" : `${l.deviationPct}%`}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatKz(l.available)}</td>
                          </>
                        )}
                        {manage && (
                          <td className="px-2 py-1 text-right whitespace-nowrap">
                            {!l.isGroup && (
                              <IconBtn label="Editar rubrica" onClick={() => setEdit(l)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </IconBtn>
                            )}
                            <IconBtn label="Nova sub-rubrica" onClick={() => setAdding(l)}>
                              <Plus className="h-3.5 w-3.5" />
                            </IconBtn>
                            {!l.isGroup && !l.executed && (
                              <IconBtn label="Eliminar rubrica" danger onClick={() => setDel(l)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </IconBtn>
                            )}
                          </td>
                        )}
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-3 text-[11px] text-graphite-500">
              Valores a azul: movimentos do sistema. Os grupos somam as sub-rubricas. O fundo de reserva é mostrado em “Fundos” e não é somado às despesas correntes.{" "}
              <Link href="/painel/despesas" className={buttonClass("ghost", "sm", "ml-1")}>
                Ver despesas
              </Link>
            </p>
          </Card>
        </>
      )}
      {edit && <EditLine line={edit} onClose={() => setEdit(null)} onSaved={reload} />}
      {adding && b && <AddLine parent={adding} budgetId={b.id} onClose={() => setAdding(null)} onSaved={reload} />}
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        title="Eliminar rubrica?"
        description={del ? `${del.name} — só é possível sem execução nem movimentos associados. Fica na auditoria.` : ""}
        confirmLabel="Eliminar"
        onConfirm={async () => {
          try {
            await apiJson(`/api/budget/lines/${del!.id}`, { method: "DELETE" });
            toast.success("Rubrica eliminada.");
            reload();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erro");
          }
          setDel(null);
        }}
      />
    </>
  );
}

function EditLine({ line, onClose, onSaved }: { line: Line; onClose: () => void; onSaved: () => void }) {
  const [annual, setAnnual] = useState(String(line.annual));
  const [monthly, setMonthly] = useState(line.monthly.map(String));
  const [mode, setMode] = useState<"anual" | "mensal">("anual");
  const [name, setName] = useState(line.name);
  const save = async () => {
    try {
      await apiJson(`/api/budget/lines/${line.id}`, { method: "PATCH", json: mode === "anual" ? { name, annualAmount: Number(annual), monthly: null } : { name, monthly: monthly.map(Number) } });
      toast.success("Rubrica actualizada (alteração na auditoria).");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Editar rubrica"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void save()}>Guardar</Button>
        </>
      }
    >
      <Field label="Nome" className="mb-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Tabs className="mb-3 w-fit" value={mode} onChange={setMode} tabs={[{ id: "anual", label: "Valor anual (÷ 12)" }, { id: "mensal", label: "Orçamento mensal" }]} />
      {mode === "anual" ? (
        <Field label="Orçamento anual (Kz)">
          <Input type="number" min={0} step="0.01" value={annual} onChange={(e) => setAnnual(e.target.value)} />
        </Field>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {MONTHS.map((m, i) => (
            <Field key={m} label={m}>
              <Input type="number" min={0} step="0.01" value={monthly[i]} onChange={(e) => setMonthly(monthly.map((v, j) => (j === i ? e.target.value : v)))} />
            </Field>
          ))}
          <p className="col-span-full text-xs text-graphite-500">Total anual: {formatKz(monthly.reduce((a, v) => a + (Number(v) || 0), 0))}</p>
        </div>
      )}
    </Modal>
  );
}

function AddLine({ parent, budgetId, onClose, onSaved }: { parent: Line; budgetId: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [annual, setAnnual] = useState("0");
  const save = async () => {
    try {
      await apiJson("/api/budget/lines", { method: "POST", json: { budgetId, parentId: parent.id, kind: parent.kind, name, annualAmount: Number(annual) } });
      toast.success("Sub-rubrica criada.");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Nova sub-rubrica de “${parent.name}”`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void save()}>Criar</Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Nome" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Orçamento anual (Kz)">
          <Input type="number" min={0} value={annual} onChange={(e) => setAnnual(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
