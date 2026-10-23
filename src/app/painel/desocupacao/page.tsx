"use client";

import { ArrowLeft, FileSignature, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { MoveOutStatus } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { useCurrentResident } from "@/hooks/use-session";
import { can } from "@/config/permissions";
import { formatDate, todayISO } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { MoveOutDetail } from "@/components/app/moveout/moveout-detail";

type Filter = "activos" | MoveOutStatus | "todos";

export default function DesocupacaoPage() {
  const { session, resident, apartment } = useCurrentResident();
  const moveOuts = useDemoStore((s) => s.moveOuts);
  const isResident = can(session?.role, "moveout.request");
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("activos");

  if (isResident) {
    const mine = moveOuts.filter((m) => m.residentId === resident?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const active = mine.find((m) => !["concluida", "cancelada"].includes(m.status));
    return (
      <>
        <PageHeader eyebrow="Minha área" title="Solicitação de Desocupação do Imóvel" description="Processo administrativo de regularização financeira e verificação operacional antes da saída." />
        {active ? (
          <MoveOutDetail key={active.id} id={active.id} />
        ) : (
          <RequestForm residentName={resident?.name ?? ""} block={apartment?.block ?? ""} number={apartment?.number ?? ""} typology={apartment?.typology ?? ""} phone={resident?.phone ?? ""} />
        )}
        {mine.filter((m) => m.id !== active?.id).length > 0 && (
          <Card className="mt-6">
            <CardHeader title="Processos anteriores" />
            <DataTable rows={mine.filter((m) => m.id !== active?.id)} rowKey={(m) => m.id} columns={[{ key: "r", header: "Processo", primary: true, cell: (m) => m.reference }, { key: "d", header: "Data prevista", cell: (m) => formatDate(m.plannedDate) }, { key: "s", header: "Estado", cell: (m) => <StatusBadge status={m.status} /> }]} />
          </Card>
        )}
        <DemoDataNote className="mt-6">Não existe impedimento físico de saída — o portal apenas regista o processo administrativo.</DemoDataNote>
      </>
    );
  }

  if (selected) {
    return (
      <>
        <Button variant="ghost" className="mb-4" onClick={() => setSelected(null)}>
          <ArrowLeft className="h-4 w-4" /> Todos os processos
        </Button>
        <MoveOutDetail key={selected} id={selected} />
      </>
    );
  }

  const rows = moveOuts
    .filter((m) => (filter === "todos" ? true : filter === "activos" ? !["concluida", "cancelada"].includes(m.status) : m.status === filter))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const count = (st: MoveOutStatus) => moveOuts.filter((m) => m.status === st).length;
  const role = session?.role;

  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title="Desocupação de imóveis"
        description={
          role === "financeiro" ? "Verificação financeira: conta corrente, valores em aberto e autorização." : role === "gestor" ? "Verificação operacional: vistoria, chaves, equipamentos e autorização." : "Supervisão dos processos de desocupação."
        }
      />
      <Card>
        <div className="border-b border-graphite-100 p-3">
          <Tabs<Filter>
            value={filter}
            onChange={setFilter}
            tabs={[
              { id: "activos", label: "Em curso", count: moveOuts.filter((m) => !["concluida", "cancelada"].includes(m.status)).length },
              { id: "regularizacao_pendente", label: "Regularização pendente", count: count("regularizacao_pendente") },
              { id: "aguardando_aprovacao", label: "Aguardando aprovação", count: count("aguardando_aprovacao") },
              { id: "autorizada", label: "Autorizadas", count: count("autorizada") },
              { id: "concluida", label: "Concluídas", count: count("concluida") },
              { id: "todos", label: "Todos" },
            ]}
          />
        </div>
        <DataTable
          rows={rows}
          rowKey={(m) => m.id}
          onRowClick={(m) => setSelected(m.id)}
          emptyTitle="Sem processos"
          columns={[
            { key: "ref", header: "Processo", primary: true, cell: (m) => <span className="font-semibold text-navy-900">{m.reference}</span> },
            { key: "res", header: "Morador", cell: (m) => m.residentName },
            { key: "apt", header: "Fracção", cell: (m) => `Bloco ${m.block} · ${m.number} (${m.typology})` },
            { key: "d", header: "Saída prevista", cell: (m) => formatDate(m.plannedDate) },
            { key: "fin", header: "Financeira", hideOnMobile: true, cell: (m) => <StatusBadge status={m.financial.status} /> },
            { key: "op", header: "Operacional", hideOnMobile: true, cell: (m) => <StatusBadge status={m.operational.status} /> },
            { key: "st", header: "Estado", cell: (m) => <StatusBadge status={m.status} /> },
          ]}
        />
      </Card>
    </>
  );
}

function RequestForm({ residentName, block, number, typology, phone }: { residentName: string; block: string; number: string; typology: string; phone: string }) {
  const request = useDemoStore((s) => s.requestMoveOut);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ plannedDate: "", reason: "", contact: phone, notes: "" });

  if (!open)
    return (
      <Card>
        <EmptyState
          icon={LogOut}
          title="Sem processo de desocupação em curso"
          description="Ao solicitar a desocupação, é emitido um extracto da conta corrente e o processo segue para verificação financeira e operacional."
          action={
            <Button onClick={() => setOpen(true)}>
              <FileSignature className="h-4 w-4" /> Solicitar Desocupação
            </Button>
          }
        />
      </Card>
    );

  const submit = () => {
    if (!form.plannedDate) return toast.error("Indique a data prevista de saída.");
    if (!form.contact.trim()) return toast.error("Indique um contacto.");
    try {
      const m = request({ plannedDate: form.plannedDate, reason: form.reason.trim() || undefined, contact: form.contact.trim(), notes: form.notes.trim() || undefined });
      toast.success(`Solicitação registada — processo ${m.reference}`, { description: "Gestor Operacional e Gestor Financeiro notificados." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registar.");
    }
  };

  return (
    <Card>
      <CardHeader title="Solicitar Desocupação" description="Os dados da fracção são preenchidos a partir do seu registo." />
      <CardBody className="grid gap-4 sm:grid-cols-2" data-testid="moveout-form">
        <Field label="Nome do morador">
          <Input value={residentName} readOnly />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Bloco">
            <Input value={block} readOnly />
          </Field>
          <Field label="Apartamento">
            <Input value={number} readOnly />
          </Field>
          <Field label="Tipologia">
            <Input value={typology} readOnly />
          </Field>
        </div>
        <Field label="Data prevista de saída" required>
          <Input type="date" name="plannedDate" min={todayISO()} value={form.plannedDate} onChange={(e) => setForm({ ...form, plannedDate: e.target.value })} />
        </Field>
        <Field label="Contacto" required>
          <Input name="contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
        </Field>
        <Field label="Motivo" hint="Opcional" className="sm:col-span-2">
          <Input name="reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <div className="flex gap-2 sm:col-span-2">
          <Button onClick={submit}>Submeter solicitação</Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
