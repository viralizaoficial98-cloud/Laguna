"use client";

import { useState } from "react";
import { useApi } from "@/hooks/use-api";
import { downloadXlsx } from "@/lib/excel-export";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Field, Input, Select } from "@/components/ui/field";
import { SearchInput } from "@/components/ui/search-input";
import { Badge } from "@/components/ui/badge";

interface Row {
  source: string;
  at: string;
  by: string;
  action: string;
  entity: string;
  details: string;
  ok?: boolean;
}
const SRC: Record<string, string> = { negocio: "Negócio", utilizadores: "Utilizadores", operacoes: "Operações", importacoes: "Importações" };

/** Auditoria — apenas consulta (não existe operação de eliminação). */
export default function AuditoriaPage() {
  const [source, setSource] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const params = new URLSearchParams({ ...(source ? { source } : {}), ...(q ? { q } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), take: "500" });
  const { data } = useApi<{ rows: Row[] }>(`/api/audit?${params}`);
  const rows = data?.rows ?? [];
  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Auditoria"
        description="Histórico de alterações e operações: quem, quando, o quê e o resultado. Registos inalteráveis — não podem ser editados nem eliminados por nenhum perfil."
        actions={
          <Button variant="outline" onClick={() => void downloadXlsx("laguna-auditoria.xlsx", [{ name: "Auditoria", head: ["Data", "Origem", "Utilizador", "Operação", "Entidade", "Detalhes", "Resultado"], rows: rows.map((r) => [formatDateTime(r.at), SRC[r.source], r.by, r.action, r.entity, r.details, r.ok === undefined ? "" : r.ok ? "aceite" : "recusada"]) }])}>
            Excel
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:items-end">
        <Field label="Origem" className="sm:w-44">
          <Select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(SRC).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="De" className="sm:w-40">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Até" className="sm:w-40">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <SearchInput value={q} onChange={setQ} placeholder="Pesquisar…" className="col-span-2 sm:w-64" />
      </div>
      <Card>
        <DataTable
          rows={rows}
          rowKey={(r) => r.source + r.at + r.action + r.entity}
          pageSize={30}
          emptyTitle={data ? "Sem registos" : "A carregar…"}
          columns={[
            { key: "at", header: "Data", cell: (r) => <span className="text-xs whitespace-nowrap">{formatDateTime(r.at)}</span> },
            { key: "s", header: "Origem", cell: (r) => <Badge tone={r.source === "utilizadores" ? "violet" : r.source === "operacoes" ? "info" : r.source === "importacoes" ? "gold" : "navy"}>{SRC[r.source]}</Badge> },
            { key: "by", header: "Utilizador", cell: (r) => <span className="text-xs">{r.by}</span> },
            { key: "a", header: "Operação", primary: true, cell: (r) => <span className="font-medium text-navy-900">{r.action}{r.ok === false && <Badge tone="danger" className="ml-2">recusada</Badge>}</span> },
            { key: "e", header: "Detalhes", hideOnMobile: true, cell: (r) => <span className="line-clamp-2 text-xs text-graphite-600">{r.entity}{r.details ? ` · ${r.details}` : ""}</span> },
          ]}
        />
      </Card>
    </>
  );
}
