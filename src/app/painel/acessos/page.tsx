"use client";

import { ArrowDownLeft, ArrowUpRight, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useDemoStore, aptLabel } from "@/store/demo-store";
import { downloadCsv, formatDate, formatTime, includesText } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Input, Select } from "@/components/ui/field";
import { Toolbar } from "@/components/ui/toolbar";
import { Badge } from "@/components/ui/badge";
import { DemoDataNote } from "@/components/ui/demo-badge";

const CAT_LABEL = { morador: "Morador", visitante: "Visitante", prestador: "Prestador de serviço", entrega: "Entrega" } as const;

export default function AcessosPage() {
  const logs = useDemoStore((s) => s.accessLogs);
  const apartments = useDemoStore((s) => s.apartments);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [cat, setCat] = useState("");
  const [date, setDate] = useState("");

  const rows = useMemo(
    () => logs.filter((l) => (!type || l.type === type) && (!cat || l.category === cat) && (!date || l.at.startsWith(date)) && includesText([l.person, aptLabel(apartments, l.apartmentId)], q)),
    [logs, type, cat, date, q, apartments],
  );

  return (
    <>
      <PageHeader
        eyebrow="Portaria"
        title="Histórico de acessos"
        description="Entradas e saídas registadas na entrada principal."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              downloadCsv("laguna-acessos-demo.csv", [["Data", "Hora", "Tipo", "Pessoa", "Categoria", "Apartamento", "Portão"], ...rows.map((l) => [formatDate(l.at), formatTime(l.at), l.type, l.person, CAT_LABEL[l.category], aptLabel(apartments, l.apartmentId), l.gate])]);
              toast.success("Histórico exportado (CSV).");
            }}
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        }
      />
      <Card>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Pessoa ou apartamento…" className="sm:w-64" />
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <Select value={type} onChange={(e) => setType(e.target.value)} className="sm:w-36" aria-label="Tipo">
              <option value="">Entradas e saídas</option>
              <option value="entrada">Entradas</option>
              <option value="saida">Saídas</option>
            </Select>
            <Select value={cat} onChange={(e) => setCat(e.target.value)} className="sm:w-44" aria-label="Categoria">
              <option value="">Todas as categorias</option>
              {Object.entries(CAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:w-40" aria-label="Data" />
          </div>
          <DemoDataNote className="sm:ml-auto" />
        </Toolbar>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          pageSize={15}
          dense
          columns={[
            { key: "at", header: "Data / hora", cell: (l) => <span className="tabular-nums">{formatDate(l.at, { day: "2-digit", month: "2-digit" })} · {formatTime(l.at)}</span> },
            {
              key: "type",
              header: "Movimento",
              cell: (l) =>
                l.type === "entrada" ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700"><ArrowDownLeft className="h-4 w-4" /> Entrada</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-graphite-500"><ArrowUpRight className="h-4 w-4" /> Saída</span>
                ),
            },
            { key: "person", header: "Pessoa", primary: true, cell: (l) => <span className="font-medium text-navy-900">{l.person}</span> },
            { key: "cat", header: "Categoria", cell: (l) => <Badge tone={l.category === "morador" ? "navy" : l.category === "visitante" ? "gold" : "neutral"}>{CAT_LABEL[l.category]}</Badge> },
            { key: "apt", header: "Apartamento", cell: (l) => aptLabel(apartments, l.apartmentId) },
            { key: "gate", header: "Portão", cell: (l) => l.gate, hideOnMobile: true },
          ]}
        />
      </Card>
    </>
  );
}
