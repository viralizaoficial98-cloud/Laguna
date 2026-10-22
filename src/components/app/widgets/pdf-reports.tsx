"use client";

import { Download, Eye, FileBarChart, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { CURRENT_PERIOD, useFinance } from "@/hooks/use-finance";
import { useOperations } from "@/hooks/use-operations";
import { can } from "@/config/permissions";
import { formatDate, parseQuarter, todayISO } from "@/lib/utils";
import { financialReport, operationalReport } from "@/lib/reports";
import { downloadReportPdf, reportPdfUrl, type ReportSpec } from "@/lib/report-pdf";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PeriodFilter, periodLabel, periodRange, type PeriodValue } from "@/components/app/dashboards/period-filter";

type OpsKind = "diario" | "semanal" | "mensal" | "manutencao" | "ocorrencias" | "fiscalizacao";
const KINDS: { id: OpsKind; label: string }[] = [
  { id: "diario", label: "Relatório diário" },
  { id: "semanal", label: "Relatório semanal" },
  { id: "mensal", label: "Relatório mensal" },
  { id: "manutencao", label: "Relatório de manutenção" },
  { id: "ocorrencias", label: "Relatório de ocorrências" },
  { id: "fiscalizacao", label: "Relatório de fiscalização de serviços" },
];

function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Geração de relatórios em PDF conforme o perfil (executivos para o Administrador, operacionais para ambos). */
export function PdfReports() {
  const session = useSession();
  const executive = can(session?.role, "reports.executive");
  const operational = can(session?.role, "reports.operational");
  const cur = parseQuarter(CURRENT_PERIOD);
  const [period, setPeriod] = useState<PeriodValue>({ year: cur.year, quarter: cur.quarter });
  const f = useFinance({ year: period.year, quarter: period.quarter || undefined, block: period.block });
  const execOps = useOperations({ ...periodRange(period), block: period.block });

  const today = todayISO();
  const [kind, setKind] = useState<OpsKind>("semanal");
  const [ref, setRef] = useState(today);
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);
  // intervalo do relatório operacional (mensal = do dia 1 do mês até à data escolhida)
  const monthRange =
    kind === "diario" ? { from: ref, to: ref } : kind === "semanal" ? { from: addDays(ref, -6), to: ref } : kind === "mensal" ? { from: `${ref.slice(0, 8)}01`, to: ref } : { from, to };
  const ops = useOperations(monthRange);

  const [preview, setPreview] = useState<{ url: string; spec: ReportSpec } | null>(null);
  const [busy, setBusy] = useState(false);
  const author = `${session?.name ?? ""} — ${session?.title ?? ""}`;
  const periodTxt = `${periodLabel(period)}${period.block ? ` · Bloco ${period.block}` : ""}`;
  const opsPeriodTxt = monthRange.from === monthRange.to ? formatDate(monthRange.from) : `${formatDate(monthRange.from)} a ${formatDate(monthRange.to)}`;

  const open = async (spec: ReportSpec) => {
    setBusy(true);
    try {
      setPreview({ url: await reportPdfUrl(spec), spec });
    } catch {
      toast.error("Não foi possível gerar o relatório.");
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {executive && (
        <Card>
          <CardHeader title="Relatórios executivos (PDF)" description="Identificação, período, indicadores, gráficos, resumo, pendências e recomendações" action={<FileBarChart className="h-5 w-5 text-gold-600" />} />
          <CardBody className="space-y-4">
            <PeriodFilter value={period} onChange={setPeriod} years={f.years} withBlock />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-graphite-100 p-4">
                <p className="font-semibold text-navy-900">Relatório financeiro</p>
                <p className="mt-1 text-xs text-graphite-500">Receitas, cobrança, dívida por bloco, despesas e resultado.</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" loading={busy} onClick={() => open(financialReport(f, periodTxt, author))}>
                    <Eye className="h-3.5 w-3.5" /> Ver
                  </Button>
                  <Button size="sm" onClick={() => void downloadReportPdf(financialReport(f, periodTxt, author))}>
                    <Download className="h-3.5 w-3.5" /> PDF
                  </Button>
                </div>
              </div>
              <div className="rounded-2xl border border-graphite-100 p-4">
                <p className="font-semibold text-navy-900">Relatório operacional</p>
                <p className="mt-1 text-xs text-graphite-500">Elevadores, ocorrências, serviços, manutenção e equipas.</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" loading={busy} onClick={() => open(operationalReport("executivo", execOps, periodTxt, author))}>
                    <Eye className="h-3.5 w-3.5" /> Ver
                  </Button>
                  <Button size="sm" onClick={() => void downloadReportPdf(operationalReport("executivo", execOps, periodTxt, author))}>
                    <Download className="h-3.5 w-3.5" /> PDF
                  </Button>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
      {operational && (
        <Card>
          <CardHeader title="Relatórios operacionais (PDF)" description="Acompanhamento de manutenção, ocorrências e fiscalização de serviços" action={<FileText className="h-5 w-5 text-gold-600" />} />
          <CardBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo de relatório">
                <Select value={kind} onChange={(e) => setKind(e.target.value as OpsKind)}>
                  {KINDS.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </Select>
              </Field>
              {kind === "diario" || kind === "semanal" || kind === "mensal" ? (
                <Field label={kind === "diario" ? "Dia" : kind === "semanal" ? "Semana até" : "Mês (até à data)"}>
                  <Input type="date" value={ref} onChange={(e) => setRef(e.target.value)} max={today} />
                </Field>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="De">
                    <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                  </Field>
                  <Field label="Até">
                    <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                  </Field>
                </div>
              )}
            </div>
            <p className="text-xs text-graphite-500">Período: {opsPeriodTxt}</p>
            <div className="flex gap-2">
              <Button variant="outline" loading={busy} onClick={() => open(operationalReport(kind, ops, opsPeriodTxt, author))}>
                <Eye className="h-4 w-4" /> Pré-visualizar
              </Button>
              <Button onClick={() => void downloadReportPdf(operationalReport(kind, ops, opsPeriodTxt, author))}>
                <Download className="h-4 w-4" /> Descarregar PDF
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
      <Modal open={!!preview} onClose={close} size="xl" title={preview?.spec.title} description={preview?.spec.period} footer={preview && <Button onClick={() => void downloadReportPdf(preview.spec)}><Download className="h-4 w-4" /> Descarregar</Button>}>
        {preview && <iframe src={preview.url} title={preview.spec.title} className="h-[75vh] w-full rounded-xl border border-graphite-100" />}
      </Modal>
    </div>
  );
}
