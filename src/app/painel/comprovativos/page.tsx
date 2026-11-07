"use client";

import { FileText, ImageIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { Payment } from "@/types";
import { useDemoStore, aptLabel } from "@/store/demo-store";
import { useCurrentResident } from "@/hooks/use-session";
import { formatBytes, formatDate, formatKz, formatQuarter, includesText } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Toolbar } from "@/components/ui/toolbar";
import { Tabs } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { ProofPreview } from "@/components/app/widgets/review-payment-modal";

export default function ComprovativosPage() {
  const { session } = useCurrentResident();
  return session?.role === "morador" ? <MyProofs /> : <AllProofs />;
}

/** Gestão: todos os comprovativos (enviados pelo morador ou carregados pela gestão) e pagamentos sem comprovativo. */
function AllProofs() {
  const payments = useDemoStore((s) => s.payments);
  const quotas = useDemoStore((s) => s.quotas);
  const apartments = useDemoStore((s) => s.apartments);
  const [sel, setSel] = useState<Payment | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"todos" | "com" | "sem" | "presencial">("todos");
  const rows = useMemo(
    () =>
      payments
        .filter((p) => (filter === "todos" ? !!p.proof || p.channel === "presencial" : filter === "com" ? !!p.proof : filter === "sem" ? !p.proof : p.channel === "presencial"))
        .filter((p) => includesText([aptLabel(apartments, p.apartmentId), p.proof?.name, p.reference, p.registeredBy], q))
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [payments, filter, q, apartments],
  );
  return (
    <>
      <PageHeader eyebrow="Gestão Financeira" title="Comprovativos" description="Comprovativos enviados pelos moradores ou carregados pela gestão em nome do morador, e pagamentos registados sem comprovativo documental." />
      <Card>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Fracção, ficheiro, referência…" className="sm:w-72" />
          <Tabs<typeof filter>
            value={filter}
            onChange={setFilter}
            tabs={[
              { id: "todos", label: "Todos" },
              { id: "com", label: "Com comprovativo" },
              { id: "sem", label: "Sem comprovativo" },
              { id: "presencial", label: "Registados pela gestão" },
            ]}
          />
        </Toolbar>
        <DataTable
          rows={rows}
          rowKey={(p) => p.id}
          onRowClick={setSel}
          columns={[
            { key: "a", header: "Fracção", primary: true, cell: (p) => <span className="font-semibold text-navy-900">{aptLabel(apartments, p.apartmentId)}</span> },
            { key: "q", header: "Trimestre", cell: (p) => (quotas.find((x) => x.id === p.quotaId) ? formatQuarter(quotas.find((x) => x.id === p.quotaId)!.period, "short") : "—") },
            { key: "v", header: "Valor", align: "right", cell: (p) => formatKz(p.amount) },
            { key: "f", header: "Comprovativo", cell: (p) => (p.proof ? p.proof.name : <span className="text-amber-700">Sem comprovativo documental</span>) },
            { key: "c", header: "Origem", hideOnMobile: true, cell: (p) => (p.channel === "presencial" ? `Gestão · ${p.registeredBy ?? ""}` : "Morador (portal)") },
            { key: "s", header: "Estado", cell: (p) => <StatusBadge status={p.status} /> },
          ]}
        />
      </Card>
      <Modal open={!!sel} onClose={() => setSel(null)} size="lg" title={sel?.proof?.name ?? "Pagamento sem comprovativo"} description={sel ? `${aptLabel(apartments, sel.apartmentId)} · referência ${sel.reference || "não indicada"}` : ""}>
        {sel && <ProofPreview payment={sel} />}
      </Modal>
    </>
  );
}

function MyProofs() {
  const { apartment } = useCurrentResident();
  const payments = useDemoStore((s) => s.payments);
  const quotas = useDemoStore((s) => s.quotas);
  const [sel, setSel] = useState<Payment | null>(null);
  const list = useMemo(() => payments.filter((p) => p.apartmentId === apartment?.id && p.proof).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)), [payments, apartment]);

  return (
    <>
      <PageHeader eyebrow="Minha área" title="Comprovativos" description="Comprovativos de pagamento enviados para a administração." />
      {list.length === 0 ? (
        <div className="rounded-3xl border border-graphite-100 bg-white">
          <EmptyState title="Sem comprovativos" description="Os comprovativos enviados aparecem aqui." />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const isImg = p.proof?.type.startsWith("image/");
            const q = quotas.find((x) => x.id === p.quotaId);
            return (
              <button key={p.id} onClick={() => setSel(p)} className="group flex items-start gap-4 rounded-2xl border border-graphite-100 bg-white p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-700 transition group-hover:bg-navy-900 group-hover:text-gold-300">
                  {isImg ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-navy-900">{p.proof?.name}</span>
                  <span className="block text-xs text-graphite-500">
                    {q ? formatQuarter(q.period) : ""} · {formatKz(p.amount)}
                  </span>
                  <span className="mt-2 flex items-center justify-between gap-2">
                    <StatusBadge status={p.status} />
                    <span className="text-[11px] text-graphite-400">
                      {formatDate(p.submittedAt)} · {formatBytes(p.proof?.size ?? 0)}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      <Modal open={!!sel} onClose={() => setSel(null)} size="lg" title={sel?.proof?.name ?? ""} description={sel ? `Referência ${sel.reference || "não indicada"}` : ""}>
        {sel && <ProofPreview payment={sel} />}
      </Modal>
    </>
  );
}
