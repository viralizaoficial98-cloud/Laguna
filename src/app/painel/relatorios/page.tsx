"use client";

import { Download, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useDemoStore, aptLabel } from "@/store/demo-store";
import { useSession } from "@/hooks/use-session";
import { useFinance } from "@/hooks/use-finance";
import { downloadCsv, formatKz, formatQuarter } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { StatusBadge, statusLabel } from "@/components/ui/status-badge";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { Donut, GroupedBars, HBars } from "@/components/charts/charts";

type Report = "moradores" | "apartamentos" | "ocupacao" | "pagamentos" | "quotas" | "receitas" | "ocorrencias" | "visitas";

interface Table {
  head: string[];
  rows: (string | number)[][];
}

export default function RelatoriosPage() {
  const session = useSession();
  const financeOnly = session?.role === "financeiro";
  const [report, setReport] = useState<Report>(financeOnly ? "receitas" : "ocupacao");
  const apartments = useDemoStore((s) => s.apartments);
  const residents = useDemoStore((s) => s.residents);
  const payments = useDemoStore((s) => s.payments);
  const quotas = useDemoStore((s) => s.quotas);
  const occurrences = useDemoStore((s) => s.occurrences);
  const visits = useDemoStore((s) => s.visits);
  const f = useFinance();

  const tabs: { id: Report; label: string }[] = [
    ...(financeOnly
      ? []
      : ([
          { id: "ocupacao", label: "Ocupação" },
          { id: "apartamentos", label: "Apartamentos" },
          { id: "moradores", label: "Moradores" },
        ] as const)),
    { id: "receitas", label: "Receitas" },
    { id: "quotas", label: "Quotas" },
    { id: "pagamentos", label: "Pagamentos" },
    ...(financeOnly
      ? []
      : ([
          { id: "visitas", label: "Visitas" },
          { id: "ocorrencias", label: "Ocorrências" },
        ] as const)),
  ];

  const blocks = useMemo(() => Array.from(new Set(apartments.map((a) => a.block))).sort(), [apartments]);

  const data = useMemo(() => {
    switch (report) {
      case "ocupacao": {
        const byBlock = blocks.map((b) => {
          const l = apartments.filter((a) => a.block === b);
          return { label: b, ocupados: l.filter((a) => a.status === "ocupado").length, livres: l.filter((a) => a.status !== "ocupado").length, total: l.length };
        });
        return {
          chart: <GroupedBars data={byBlock} currency={false} series={[{ key: "ocupados", label: "Ocupados" }, { key: "livres", label: "Livres / manutenção" }]} />,
          side: <Donut data={[{ key: "o", label: "Ocupados", value: apartments.filter((a) => a.status === "ocupado").length }, { key: "d", label: "Disponíveis", value: apartments.filter((a) => a.status === "disponivel").length }, { key: "m", label: "Manutenção", value: apartments.filter((a) => a.status === "manutencao").length }]} />,
          table: { head: ["Bloco", "Total", "Ocupados", "Livres / manutenção", "Taxa de ocupação"], rows: byBlock.map((b) => [`Bloco ${b.label}`, b.total, b.ocupados, b.livres, `${Math.round((b.ocupados / b.total) * 100)}%`]) } as Table,
        };
      }
      case "apartamentos": {
        const byTyp = [...(["T2", "T3", "T4"] as const).map((t) => ({ label: t as string, value: apartments.filter((a) => a.typology === t).length })), { label: "Por definir", value: apartments.filter((a) => !a.typology).length }];
        return {
          chart: <HBars data={byTyp} />,
          side: <Donut data={byTyp.map((t) => ({ key: t.label, label: t.label, value: t.value }))} />,
          table: { head: ["Bloco", "Apartamento", "Tipologia", "Piso", "Cadastro", "Estado"], rows: apartments.map((a) => [`Bloco ${a.block}`, a.number, a.typology ?? "Por definir", a.floor, a.provisional ? "Provisório" : "Validado", a.active ? statusLabel(a.status) : "Desactivado"]) } as Table,
        };
      }
      case "moradores": {
        const byBlock = blocks.map((b) => ({ label: `Bloco ${b}`, value: residents.filter((r) => r.apartmentId?.startsWith(`apt_${b}_`)).length }));
        return {
          chart: <HBars data={byBlock} />,
          side: <Donut data={[{ key: "p", label: "Proprietários", value: residents.filter((r) => r.type === "proprietario").length }, { key: "i", label: "Inquilinos", value: residents.filter((r) => r.type === "inquilino").length }]} />,
          table: { head: ["Nome", "Apartamento", "Tipo", "Dependentes", "Estado"], rows: residents.map((r) => [r.name, aptLabel(apartments, r.apartmentId), r.type === "proprietario" ? "Proprietário" : "Inquilino", r.dependents.length, statusLabel(r.status)]) } as Table,
        };
      }
      case "receitas":
        return {
          chart: <GroupedBars data={f.quarterly} series={[{ key: "emitido", label: "Emitido" }, { key: "recebido", label: "Recebido" }]} />,
          side: <Donut useStatusColors data={f.statusCounts.map((s) => ({ key: s.status, value: s.count }))} />,
          table: { head: ["Trimestre", "Emitido (Kz)", "Recebido (Kz)", "Em atraso (Kz)", "Cobrança"], rows: f.quarterly.map((m) => [formatQuarter(m.period), m.emitido, m.recebido, m.emAtraso, `${m.emitido ? Math.round((m.recebido / m.emitido) * 100) : 0}%`]) } as Table,
        };
      case "quotas":
        return {
          chart: <HBars data={f.statusCounts.map((s) => ({ label: statusLabel(s.status), value: s.count }))} />,
          side: <Donut useStatusColors data={f.statusCounts.map((s) => ({ key: s.status, value: s.count }))} />,
          table: { head: ["Estado", "N.º de quotas", "Valor (Kz)"], rows: f.statusCounts.map((s) => [statusLabel(s.status), s.count, s.amount]) } as Table,
        };
      case "pagamentos": {
        const methods = ["transferencia", "multicaixa", "deposito", "numerario"] as const;
        const labels = { transferencia: "Transferência", multicaixa: "Multicaixa", deposito: "Depósito", numerario: "Numerário" };
        return {
          chart: <HBars currency data={methods.map((m) => ({ label: labels[m], value: payments.filter((p) => p.method === m && p.status === "aprovado").reduce((a, p) => a + p.amount, 0) }))} />,
          side: <Donut data={(["aprovado", "em_analise", "rejeitado"] as const).map((s) => ({ key: s, value: payments.filter((p) => p.status === s).length }))} />,
          table: {
            head: ["Fracção", "Trimestre", "Referência", "Método", "Valor (Kz)", "Estado"],
            rows: [...payments].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map((p) => [aptLabel(apartments, p.apartmentId), formatQuarter(quotas.find((q) => q.id === p.quotaId)?.period ?? "2026-T1"), p.reference, labels[p.method], p.amount, statusLabel(p.status)]),
          } as Table,
        };
      }
      case "visitas": {
        const byBlock = blocks.map((b) => ({ label: `Bloco ${b}`, value: visits.filter((v) => v.apartmentId.startsWith(`apt_${b}_`) && v.status === "autorizada").length }));
        return {
          chart: <HBars data={byBlock} />,
          side: <Donut data={[{ key: "i", label: "Individuais", value: visits.filter((v) => v.kind === "individual").length }, { key: "g", label: "Grupos / eventos", value: visits.filter((v) => v.kind === "grupo").length }, { key: "c", label: "Canceladas", value: visits.filter((v) => v.status === "cancelada").length }]} />,
          table: {
            head: ["Fracção", "Tipo", "Visitante / evento", "Pessoas", "Data", "Horário", "Situação"],
            rows: [...visits].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).map((v) => [aptLabel(apartments, v.apartmentId), v.kind === "grupo" ? "Grupo" : "Individual", v.kind === "grupo" ? v.eventName ?? "" : v.guests[0]?.name ?? "", v.guests.length, v.date.split("-").reverse().join("/"), v.time, v.status === "autorizada" ? "Autorizada" : "Cancelada"]),
          } as Table,
        };
      }
      case "ocorrencias": {
        const cats = Array.from(new Set(occurrences.map((o) => o.category)));
        return {
          chart: <HBars data={cats.map((c) => ({ label: c, value: occurrences.filter((o) => o.category === c).length }))} />,
          side: <Donut data={[{ key: "a", label: "Abertas", value: occurrences.filter((o) => o.status === "aberta").length }, { key: "c", label: "Em curso", value: occurrences.filter((o) => o.status === "em_curso").length }, { key: "r", label: "Resolvidas", value: occurrences.filter((o) => o.status === "resolvida").length }]} />,
          table: { head: ["Ocorrência", "Categoria", "Prioridade", "Estado", "Local"], rows: occurrences.map((o) => [o.title, o.category, statusLabel(o.priority), statusLabel(o.status), o.location]) } as Table,
        };
      }
    }
  }, [report, apartments, residents, payments, quotas, occurrences, visits, f, blocks]);

  const title = tabs.find((t) => t.id === report)?.label ?? "";
  const isMoney = (h: string) => h.includes("(Kz)");

  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Relatórios"
        description="Relatórios com gráficos e tabelas, exportáveis em CSV a partir dos dados de demonstração."
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
            <Button
              onClick={() => {
                downloadCsv(`relatorio-${report}-laguna-demo.csv`, [data.table.head, ...data.table.rows]);
                toast.success(`Relatório de ${title.toLowerCase()} exportado (CSV).`);
              }}
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </>
        }
      />
      <Tabs className="no-print mb-6" value={report} onChange={setReport} tabs={tabs} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={`Relatório de ${title.toLowerCase()}`} action={<DemoDataNote />} />
          <CardBody>{data.chart}</CardBody>
        </Card>
        <Card>
          <CardHeader title="Distribuição" />
          <CardBody>{data.side}</CardBody>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader title="Tabela de dados" description={`${data.table.rows.length} registos`} />
        <div className="scrollbar-thin max-h-[520px] overflow-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 bg-graphite-50">
              <tr className="text-[11px] tracking-wider text-graphite-500 uppercase">
                {data.table.head.map((h) => (
                  <th key={h} className={`px-4 py-3 ${isMoney(h) ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-100">
              {data.table.rows.map((r, i) => (
                <tr key={i} className="hover:bg-navy-50/30">
                  {r.map((c, j) => (
                    <td key={j} className={`px-4 py-2.5 ${isMoney(data.table.head[j]) ? "text-right tabular-nums" : ""} ${j === 0 ? "font-medium text-navy-900" : "text-graphite-700"}`}>
                      {isMoney(data.table.head[j]) && typeof c === "number" ? formatKz(c) : data.table.head[j] === "Estado" ? <StatusBadge status={statusKey(String(c))} /> : c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

const REVERSE: Record<string, string> = {
  Pendente: "pendente", "Em análise": "em_analise", Pago: "pago", Validado: "aprovado", Rejeitado: "rejeitado", "Em atraso": "em_atraso", Desactivado: "inactivo",
  Ocupado: "ocupado", Disponível: "disponivel", Manutenção: "manutencao", Activo: "activo", Inactivo: "inactivo",
  Aberta: "aberta", "Em curso": "em_curso", Resolvida: "resolvida",
};
function statusKey(label: string) {
  return REVERSE[label] ?? label;
}
