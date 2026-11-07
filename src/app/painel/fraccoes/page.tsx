"use client";

import { ArrowLeft, Building, FileDown, FilePlus2, HandCoins, KeySquare, UserMinus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Apartment, Payment, Quota, Resident } from "@/types";
import { useApi } from "@/hooks/use-api";
import { apiJson, fileSrc } from "@/lib/api-client";
import { BLOCKS } from "@/data/management";
import { cn, downloadCsv, formatDate, formatDateTime, formatKz, formatQuarter, includesText } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Select, Textarea, Field } from "@/components/ui/field";
import { Toolbar } from "@/components/ui/toolbar";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { Modal } from "@/components/ui/modal";
import { HolderModal } from "@/components/app/mgmt/holder-modal";

interface FractionRow {
  id: string;
  code: string;
  block: string;
  number: string;
  typology: string;
  status: string;
  active: boolean;
  ownerName: string | null;
  ownerRegistered: boolean;
  tenantName: string | null;
  residentName: string | null;
  debt: number;
  inValidation: number;
  paid: number;
}

export default function FraccoesPage() {
  return (
    <Suspense>
      <Fraccoes />
    </Suspense>
  );
}

function Fraccoes() {
  const id = useSearchParams().get("id");
  return id ? <Ficha id={id} /> : <Lista />;
}

function Lista() {
  const router = useRouter();
  const { data, error } = useApi<{ fractions: FractionRow[] }>("/api/fractions");
  const [q, setQ] = useState("");
  const [block, setBlock] = useState("");
  const [filter, setFilter] = useState<"" | "divida" | "sem_proprietario" | "com_inquilino" | "validacao">("");
  const list = useMemo(() => data?.fractions ?? [], [data]);
  const rows = useMemo(
    () =>
      list.filter(
        (f) =>
          (!block || f.block === block) &&
          includesText([f.code, f.ownerName, f.tenantName, f.residentName], q) &&
          (filter === "" || (filter === "divida" && f.debt > 0) || (filter === "sem_proprietario" && !f.ownerRegistered) || (filter === "com_inquilino" && !!f.tenantName) || (filter === "validacao" && f.inValidation > 0)),
      ),
    [list, block, q, filter],
  );
  return (
    <>
      <PageHeader
        eyebrow="Gestão do Condomínio"
        title="Fracções"
        description="100 fracções: proprietário, inquilino, morador/ocupante e situação financeira. A titularidade é independente da residência."
        actions={
          <Button
            variant="outline"
            onClick={() => downloadCsv("laguna-fraccoes.csv", [["Fracção", "Tipologia", "Proprietário", "Inquilino", "Morador/ocupante", "Dívida (Kz)", "Em validação (Kz)"], ...rows.map((f) => [f.code, f.typology, f.ownerName ?? "", f.tenantName ?? "", f.residentName ?? "", f.debt, f.inValidation])])}
          >
            <FileDown className="h-4 w-4" /> Exportar
          </Button>
        }
      />
      {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard index={0} highlight label="Fracções" value={list.length} icon={Building} hint={`${list.filter((f) => f.typology === "T2").length} T2 · ${list.filter((f) => f.typology === "Duplex").length} Duplex`} />
        <StatCard index={1} label="Com proprietário registado" value={list.filter((f) => f.ownerRegistered).length} icon={KeySquare} tone="navy" />
        <StatCard index={2} label="Com inquilino" value={list.filter((f) => f.tenantName).length} icon={Users} tone="info" />
        <StatCard index={3} label="Com dívida vencida" value={list.filter((f) => f.debt > 0).length} icon={HandCoins} tone="warning" hint={formatKz(list.reduce((a, f) => a + f.debt, 0))} />
      </div>
      <Card>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Fracção, proprietário, inquilino…" className="sm:w-72" />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select value={block} onChange={(e) => setBlock(e.target.value)} aria-label="Bloco" className="sm:w-36">
              <option value="">Todos os blocos</option>
              {BLOCKS.map((b) => (
                <option key={b} value={b}>
                  Bloco {b}
                </option>
              ))}
            </Select>
            <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filtro" className="sm:w-52">
              <option value="">Todas</option>
              <option value="divida">Com dívida vencida</option>
              <option value="validacao">Com pagamento em validação</option>
              <option value="sem_proprietario">Sem proprietário registado</option>
              <option value="com_inquilino">Com inquilino</option>
            </Select>
          </div>
        </Toolbar>
        <DataTable
          rows={rows}
          rowKey={(f) => f.id}
          pageSize={20}
          onRowClick={(f) => router.push(`/painel/fraccoes?id=${f.id}`)}
          emptyTitle={data ? "Sem resultados" : "A carregar…"}
          columns={[
            { key: "code", header: "Fracção", primary: true, cell: (f) => <span className="font-semibold text-navy-900">{f.code}</span> },
            { key: "typ", header: "Tipologia", cell: (f) => <Badge tone={f.typology === "Duplex" ? "gold" : "neutral"}>{f.typology}</Badge> },
            { key: "owner", header: "Proprietário", cell: (f) => <span className={cn(!f.ownerRegistered && "text-graphite-400 italic")}>{f.ownerName ?? "—"}</span> },
            { key: "tenant", header: "Inquilino", hideOnMobile: true, cell: (f) => f.tenantName ?? <span className="text-graphite-400">—</span> },
            { key: "res", header: "Morador / ocupante", hideOnMobile: true, cell: (f) => f.residentName ?? <span className="text-graphite-400">—</span> },
            { key: "debt", header: "Dívida", align: "right", cell: (f) => <span className={cn("tabular-nums", f.debt > 0 ? "font-semibold text-amber-700" : "text-graphite-500")}>{formatKz(f.debt)}</span> },
          ]}
        />
      </Card>
    </>
  );
}

interface FichaData {
  apartment: Apartment;
  owner: { id: string; party: { id: string; name: string; nif: string | null; email: string | null; phone: string | null }; from: string | null } | null;
  tenant: { id: string; party: { id: string; name: string; nif: string | null; email: string | null; phone: string | null }; from: string | null } | null;
  holderHistory: { id: string; role: string; active: boolean; from: string | null; to: string | null; source: string | null; party: { name: string }; createdBy: string | null; endedBy: string | null; endReason: string | null; createdAt: string }[];
  resident: Resident | null;
  formerResidents: Resident[];
  occupancies: { residentId: string; residentName: string; from: string; to?: string }[];
  account: { quotasTotal: number; paidTotal: number; inValidation: number; overdue: number; upcoming: number; confirmedDebt: number; charges: number; reservationsUnpaid: number; openItems: { origin: string; description: string; amount: number }[] };
  accountAll: { quotasTotal: number; paidTotal: number; confirmedDebt: number; inValidation: number };
  quotas: Quota[];
  payments: Payment[];
  receipts: { paymentId: string; receiptNumber: string; amount: number; at: string }[];
  declarations: { id: string; number: string; typeCode: string; status: string; subjectName: string; requestedAt: string; pdfFileId: string | null }[];
  files: { id: string; name: string; mime: string; size: number; category: string | null; createdAt: string }[];
  audit: { at: string; by: string; action: string; details: string | null }[];
}

function Ficha({ id }: { id: string }) {
  const { data, error, reload } = useApi<FichaData>(`/api/fractions/${id}`);
  const [tab, setTab] = useState<"resumo" | "financeiro" | "documentos" | "historico">("resumo");
  const [holder, setHolder] = useState<"proprietario" | "inquilino" | null>(null);
  const [ending, setEnding] = useState(false);
  const [reason, setReason] = useState("");
  if (error) return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  if (!data) return <p className="text-sm text-graphite-500">A carregar a ficha…</p>;
  const a = data.apartment;
  const code = `${a.block}-${a.number}`;
  const endTenant = async () => {
    try {
      await apiJson("/api/holders", { method: "POST", json: { op: "end", apartmentId: a.id, role: "inquilino", reason } });
      toast.success("Arrendamento encerrado — mantido no histórico.");
      setEnding(false);
      setReason("");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };
  return (
    <>
      <Link href="/painel/fraccoes" className="mb-4 inline-flex items-center gap-1 text-sm text-graphite-500 hover:text-navy-900">
        <ArrowLeft className="h-4 w-4" /> Todas as fracções
      </Link>
      <PageHeader
        eyebrow={`Bloco ${a.block} · ${a.typology === "Duplex" ? "Duplex (3 quartos, sala e varanda)" : "T2"}`}
        title={`Fracção ${code}`}
        description={`${a.active ? "Activa" : "Desactivada"} · ${a.status === "ocupado" ? "Ocupada" : a.status === "disponivel" ? "Disponível" : "Em manutenção"}${a.provisional ? " · cadastro provisório" : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/painel/pagamento-presencial?apt=${a.id}`} className={buttonClass("primary")}>
              <HandCoins className="h-4 w-4" /> Registar pagamento
            </Link>
            <Link href={`/painel/declaracoes/emitir?apt=${a.id}`} className={buttonClass("outline")}>
              <FilePlus2 className="h-4 w-4" /> Emitir declaração
            </Link>
          </div>
        }
      />
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3" data-testid="fraction-holders">
        <Card>
          <CardHeader title="Proprietário" action={<Button size="sm" variant="outline" onClick={() => setHolder("proprietario")}>{data.owner ? "Substituir" : "Associar"}</Button>} />
          <CardBody className="text-sm">
            {data.owner ? (
              <>
                <p className="font-semibold text-navy-900">{data.owner.party.name}</p>
                <p className="text-xs text-graphite-500">{[data.owner.party.nif && `NIF ${data.owner.party.nif}`, data.owner.party.phone, data.owner.party.email].filter(Boolean).join(" · ") || "Sem contactos registados"}</p>
                {data.owner.from && <p className="text-xs text-graphite-400">desde {formatDate(data.owner.from)}</p>}
              </>
            ) : (
              <p className="text-graphite-500">Sem proprietário registado{a.ownerName ? ` (cadastro: ${a.ownerName})` : ""}.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Inquilino"
            action={
              <div className="flex gap-1">
                {data.tenant && (
                  <Button size="sm" variant="ghost" onClick={() => setEnding(true)} aria-label="Encerrar arrendamento">
                    <UserMinus className="h-4 w-4" />
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setHolder("inquilino")}>
                  {data.tenant ? "Substituir" : "Associar"}
                </Button>
              </div>
            }
          />
          <CardBody className="text-sm">
            {data.tenant ? (
              <>
                <p className="font-semibold text-navy-900">{data.tenant.party.name}</p>
                <p className="text-xs text-graphite-500">{[data.tenant.party.nif && `NIF ${data.tenant.party.nif}`, data.tenant.party.phone, data.tenant.party.email].filter(Boolean).join(" · ") || "Sem contactos registados"}</p>
              </>
            ) : (
              <p className="text-graphite-500">Sem inquilino identificado.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Morador / ocupante" action={<Link href="/painel/moradores" className="text-xs font-medium text-navy-700">Cadastro</Link>} />
          <CardBody className="text-sm">
            {data.resident ? (
              <>
                <p className="font-semibold text-navy-900">{data.resident.name}</p>
                <p className="text-xs text-graphite-500">{[data.resident.phone, data.resident.email].filter(Boolean).join(" · ") || "Sem contactos registados"}</p>
                <p className="text-xs text-graphite-400">
                  {data.resident.type === "inquilino" ? "Inquilino" : "Proprietário"} · desde {formatDate(data.resident.since)}
                </p>
              </>
            ) : (
              <p className="text-graphite-500">Sem morador registado.</p>
            )}
          </CardBody>
        </Card>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard index={0} label="Quotas emitidas" value={formatKz(data.accountAll.quotasTotal)} icon={Building} />
        <StatCard index={1} highlight label="Pago" value={formatKz(data.accountAll.paidTotal)} icon={HandCoins} />
        <StatCard index={2} label="Dívida confirmada" value={formatKz(data.accountAll.confirmedDebt)} icon={KeySquare} tone="warning" />
        <StatCard index={3} label="Em validação" value={formatKz(data.accountAll.inValidation)} icon={Users} tone="gold" />
      </div>
      <Tabs
        className="mb-4 w-fit max-w-full"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "resumo", label: "Ocupação" },
          { id: "financeiro", label: "Quotas e pagamentos", count: data.payments.length },
          { id: "documentos", label: "Documentos", count: data.declarations.length + data.files.length },
          { id: "historico", label: "Histórico de alterações", count: data.audit.length },
        ]}
      />
      {tab === "resumo" && (
        <Card>
          <CardHeader title="Histórico de titularidade e ocupação" />
          <ul className="divide-y divide-graphite-100 text-sm">
            {data.holderHistory.map((h) => (
              <li key={h.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <Badge tone={h.role === "proprietario" ? "navy" : "info"}>{h.role === "proprietario" ? "Proprietário" : "Inquilino"}</Badge> <strong className="ml-2 text-navy-900">{h.party.name}</strong>
                  <span className="block text-xs text-graphite-500">
                    {h.from ? `desde ${formatDate(h.from)}` : `registado em ${formatDate(h.createdAt)}`}
                    {h.to ? ` até ${formatDate(h.to)}` : ""} · {h.source ?? "gestão"} · {h.createdBy}
                    {h.endReason ? ` · ${h.endReason}` : ""}
                  </span>
                </span>
                <Badge tone={h.active ? "success" : "neutral"}>{h.active ? "Activo" : "Encerrado"}</Badge>
              </li>
            ))}
            {data.occupancies.map((o) => (
              <li key={o.residentId + o.from} className="flex items-center justify-between px-5 py-3">
                <span>
                  <Badge tone="violet">Ocupante</Badge> <strong className="ml-2 text-navy-900">{o.residentName}</strong>
                  <span className="block text-xs text-graphite-500">
                    desde {formatDate(o.from)}
                    {o.to ? ` até ${formatDate(o.to)}` : ""}
                  </span>
                </span>
                <Badge tone={o.to ? "neutral" : "success"}>{o.to ? "Saiu" : "Actual"}</Badge>
              </li>
            ))}
            {!data.holderHistory.length && !data.occupancies.length && <li className="px-5 py-6 text-graphite-400">Sem registos.</li>}
          </ul>
        </Card>
      )}
      {tab === "financeiro" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Quotas" />
            <DataTable
              rows={data.quotas}
              rowKey={(q) => q.id}
              dense
              columns={[
                { key: "p", header: "Trimestre", primary: true, cell: (q) => formatQuarter(q.period) },
                { key: "v", header: "Valor", align: "right", cell: (q) => formatKz(q.amount) },
                { key: "pg", header: "Pago", align: "right", cell: (q) => formatKz(q.paidAmount) },
                { key: "s", header: "Estado", cell: (q) => <StatusBadge status={q.status} /> },
              ]}
            />
          </Card>
          <Card>
            <CardHeader title="Pagamentos e comprovativos" />
            <DataTable
              rows={data.payments}
              rowKey={(p) => p.id}
              dense
              columns={[
                { key: "d", header: "Data", primary: true, cell: (p) => formatDate(p.paidAt) },
                { key: "v", header: "Valor", align: "right", cell: (p) => formatKz(p.validatedAmount ?? p.amount) },
                { key: "c", header: "Canal", cell: (p) => (p.channel === "presencial" ? `Presencial · ${p.registeredBy ?? ""}` : "Portal") },
                { key: "pr", header: "Comprovativo", cell: (p) => (p.proof ? fileSrc(p.proof) ? <a href={fileSrc(p.proof)} target="_blank" rel="noreferrer" className="text-navy-700 underline">{p.proof.name}</a> : p.proof.name : <span className="text-amber-700">Sem comprovativo</span>) },
                { key: "s", header: "Estado", cell: (p) => <StatusBadge status={p.status} /> },
                { key: "r", header: "Recibo", hideOnMobile: true, cell: (p) => p.receiptNumber ?? "—" },
              ]}
            />
          </Card>
        </div>
      )}
      {tab === "documentos" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Declarações" />
            <ul className="divide-y divide-graphite-100 text-sm">
              {data.declarations.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span>
                    <strong className="text-navy-900">{d.number}</strong> · {d.subjectName}
                    <span className="block text-xs text-graphite-500">{formatDate(d.requestedAt)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={`decl_${d.status}`} />
                    {d.pdfFileId && (
                      <a href={`/api/files/${d.pdfFileId}`} target="_blank" rel="noreferrer" className="text-xs text-navy-700 underline">
                        PDF
                      </a>
                    )}
                  </span>
                </li>
              ))}
              {!data.declarations.length && <li className="px-5 py-6 text-graphite-400">Sem declarações.</li>}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Anexos da fracção" description="Comprovativos, declarações e outros ficheiros" />
            <ul className="divide-y divide-graphite-100 text-sm">
              {data.files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="truncate text-navy-700 underline">
                    {f.name}
                  </a>
                  <span className="shrink-0 text-xs text-graphite-500">
                    {f.category ?? "ficheiro"} · {formatDate(f.createdAt)}
                  </span>
                </li>
              ))}
              {!data.files.length && <li className="px-5 py-6 text-graphite-400">Sem anexos.</li>}
            </ul>
          </Card>
        </div>
      )}
      {tab === "historico" && (
        <Card>
          <ul className="divide-y divide-graphite-100 text-sm">
            {data.audit.map((h, i) => (
              <li key={i} className="px-5 py-2.5">
                <span className="text-xs text-graphite-400">{formatDateTime(h.at)}</span> · <strong>{h.action}</strong> · {h.by}
                {h.details && <span className="block text-xs text-graphite-600">{h.details}</span>}
              </li>
            ))}
            {!data.audit.length && <li className="px-5 py-6 text-graphite-400">Sem alterações registadas.</li>}
          </ul>
        </Card>
      )}
      {holder && <HolderModal apartmentId={a.id} label={code} role={holder} onClose={() => setHolder(null)} onSaved={reload} />}
      <Modal
        open={ending}
        onClose={() => setEnding(false)}
        title="Encerrar arrendamento"
        description="O inquilino deixa de estar activo; o registo fica no histórico da fracção."
        footer={
          <>
            <Button variant="outline" onClick={() => setEnding(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => void endTenant()}>
              Encerrar
            </Button>
          </>
        }
      >
        <Field label="Motivo" required>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </>
  );
}
