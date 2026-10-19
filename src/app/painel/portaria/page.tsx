"use client";

import { Eye, PartyPopper, ShieldCheck, User } from "lucide-react";
import { useMemo, useState } from "react";
import { BLOCKS } from "@/data/management";
import { useSession } from "@/hooks/use-session";
import { useVisitRows, type VisitRow } from "@/hooks/use-visits";
import { can } from "@/config/permissions";
import { cn, formatDate, includesText, todayISO } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Input, Select } from "@/components/ui/field";
import { Toolbar } from "@/components/ui/toolbar";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { VisitDetailModal } from "@/components/app/widgets/visit-detail-modal";

type Tab = "hoje" | "proximas" | "todas";

export default function PortariaPage() {
  const session = useSession();
  const rows = useVisitRows();
  const canCheck = can(session?.role, "visits.check");
  const [tab, setTab] = useState<Tab>("hoje");
  const [kind, setKind] = useState<"" | "individual" | "grupo">("");
  const [q, setQ] = useState("");
  const [block, setBlock] = useState("");
  const [apt, setApt] = useState("");
  const [date, setDate] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const today = todayISO();

  const filtered = useMemo(
    () =>
      rows
        .filter((v) => (tab === "hoje" ? v.date === today : tab === "proximas" ? v.date > today : true))
        .filter((v) => (!kind || v.kind === kind) && (!block || v.block === block) && (!apt || v.number.includes(apt.trim())) && (!date || v.date === date))
        .filter((v) => includesText([v.residentName, v.eventName, ...v.guests.map((g) => g.name), `Bloco ${v.block}`, v.number], q))
        .sort((a, b) => (tab === "todas" ? (b.date + b.time).localeCompare(a.date + a.time) : (a.date + a.time).localeCompare(b.date + b.time))),
    [rows, tab, kind, block, apt, date, q, today],
  );
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const count = (t: Tab) => rows.filter((v) => (t === "hoje" ? v.date === today : t === "proximas" ? v.date > today : true)).length;

  return (
    <>
      <PageHeader
        eyebrow="Portaria"
        title="Visitantes autorizados"
        description="Autorizações registadas pelos moradores. A Portaria consulta e confirma entradas e saídas — não cria nem altera autorizações."
      />
      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-navy-100 bg-navy-50/60 px-5 py-3.5 text-sm text-navy-900">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-navy-600" />
        <p>
          {canCheck
            ? "Abra uma autorização para confirmar a entrada e a saída de cada pessoa. O histórico fica registado e a autorização original mantém-se inalterada."
            : "Modo de consulta: a confirmação de entradas e saídas é exclusiva da Portaria."}{" "}
          <span className="text-navy-700/80">Nesta demonstração, as autorizações só são visíveis no mesmo browser em que foram criadas.</span>
        </p>
      </div>
      <Card>
        <Toolbar>
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "hoje", label: "Hoje", count: count("hoje") },
              { id: "proximas", label: "Próximas", count: count("proximas") },
              { id: "todas", label: "Todas", count: count("todas") },
            ]}
          />
          <Tabs
            value={kind}
            onChange={setKind}
            tabs={[
              { id: "", label: "Todas as visitas" },
              { id: "individual", label: "Individuais" },
              { id: "grupo", label: "Grupos / eventos" },
            ]}
          />
        </Toolbar>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Nome do visitante, convidado ou morador…" className="sm:w-72" />
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <Select value={block} onChange={(e) => setBlock(e.target.value)} className="sm:w-36" aria-label="Bloco">
              <option value="">Todos os blocos</option>
              {BLOCKS.map((b) => (
                <option key={b} value={b}>
                  Bloco {b}
                </option>
              ))}
            </Select>
            <Input value={apt} onChange={(e) => setApt(e.target.value)} placeholder="Apart." className="sm:w-28" aria-label="Apartamento" inputMode="numeric" />
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:w-40" aria-label="Data" />
          </div>
          <DemoDataNote className="sm:ml-auto" />
        </Toolbar>
        <DataTable<VisitRow>
          rows={filtered}
          rowKey={(r) => r.id}
          onRowClick={(r) => setSelectedId(r.id)}
          emptyTitle={tab === "hoje" ? "Sem visitas autorizadas para hoje" : "Sem resultados"}
          columns={[
            {
              key: "who",
              header: "Visitante / evento",
              primary: true,
              cell: (v) => (
                <span className={cn("flex items-center gap-3", v.status === "cancelada" && "opacity-50")}>
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", v.kind === "grupo" ? "bg-violet-50 text-violet-700" : "bg-navy-50 text-navy-700")}>
                    {v.kind === "grupo" ? <PartyPopper className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-navy-900">{v.kind === "grupo" ? v.eventName : v.guests[0]?.name}</span>
                    <span className="block text-xs text-graphite-500">{v.kind === "grupo" ? `${v.eventType} · ${v.guests.length} convidados` : "Visita individual"}</span>
                  </span>
                </span>
              ),
            },
            { key: "res", header: "Morador responsável", cell: (v) => v.residentName },
            { key: "block", header: "Bloco", cell: (v) => <span className="font-medium">{v.block}</span> },
            { key: "apt", header: "Apart.", cell: (v) => <span className="font-medium">{v.number}</span> },
            { key: "date", header: "Data", cell: (v) => formatDate(v.date, { day: "2-digit", month: "2-digit", year: "numeric" }) },
            { key: "time", header: "Horário", cell: (v) => v.time },
            {
              key: "presence",
              header: "Presenças",
              cell: (v) =>
                v.status === "cancelada" ? (
                  <StatusBadge status="cancelada" />
                ) : (
                  <Badge tone={v.inside ? "info" : v.left === v.guests.length ? "neutral" : "warning"}>
                    {v.inside}/{v.guests.length} dentro{v.left ? ` · ${v.left} saíram` : ""}
                  </Badge>
                ),
            },
            {
              key: "actions",
              header: "",
              align: "right",
              cell: (v) => (
                <Button size="sm" variant={canCheck ? "subtle" : "ghost"} onClick={() => setSelectedId(v.id)}>
                  <Eye className="h-3.5 w-3.5" /> {canCheck ? "Abrir" : "Ver"}
                </Button>
              ),
            },
          ]}
        />
      </Card>
      <VisitDetailModal visit={selected} onClose={() => setSelectedId(null)} />
    </>
  );
}
