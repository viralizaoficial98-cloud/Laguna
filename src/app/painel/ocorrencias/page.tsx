"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type { Occurrence, OccurrenceStatus } from "@/types";
import { useDemoStore, aptLabel } from "@/store/demo-store";
import { useSession } from "@/hooks/use-session";
import { formatDateTime, includesText, uid } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Toolbar } from "@/components/ui/toolbar";
import { Tabs } from "@/components/ui/tabs";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { DemoDataNote } from "@/components/ui/demo-badge";

const CATEGORIES = ["Segurança", "Manutenção", "Ruído", "Limpeza", "Estacionamento", "Outro"] as const;
const schema = z.object({
  title: z.string().min(5, "Descreva brevemente a ocorrência."),
  description: z.string().min(5, "Adicione detalhes."),
  category: z.enum(CATEGORIES),
  priority: z.enum(["baixa", "media", "alta"]),
  location: z.string().min(2, "Indique o local."),
  apartmentId: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function OcorrenciasPage() {
  const session = useSession();
  const occurrences = useDemoStore((s) => s.occurrences);
  const apartments = useDemoStore((s) => s.apartments);
  const save = useDemoStore((s) => s.saveOccurrence);
  const [tab, setTab] = useState<"todas" | OccurrenceStatus>("todas");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Occurrence | null>(null);

  const rows = useMemo(
    () => occurrences.filter((o) => (tab === "todas" || o.status === tab) && (!cat || o.category === cat) && includesText([o.title, o.description, o.location], q)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [occurrences, tab, cat, q],
  );
  const count = (s: OccurrenceStatus) => occurrences.filter((o) => o.status === s).length;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { category: "Segurança", priority: "media", location: "Entrada principal", apartmentId: "" } });

  const submit = (d: FormData) => {
    save({ ...d, apartmentId: d.apartmentId || undefined, id: uid("oc"), status: "aberta", createdAt: new Date().toISOString(), reportedBy: session?.name ?? "Portaria" });
    toast.success("Ocorrência registada.");
    reset();
    setOpen(false);
  };

  const setStatus = (o: Occurrence, status: OccurrenceStatus) => {
    save({ ...o, status });
    setSel({ ...o, status });
    toast.success(`Estado actualizado: ${status === "resolvida" ? "Resolvida" : status === "em_curso" ? "Em curso" : "Aberta"}`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Portaria"
        title="Ocorrências"
        description="Registo e acompanhamento de ocorrências no condomínio."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Registar ocorrência
          </Button>
        }
      />
      <Card>
        <Toolbar>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "todas", label: "Todas", count: occurrences.length },
              { id: "aberta", label: "Abertas", count: count("aberta") },
              { id: "em_curso", label: "Em curso", count: count("em_curso") },
              { id: "resolvida", label: "Resolvidas", count: count("resolvida") },
            ]}
          />
        </Toolbar>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Pesquisar ocorrências…" className="sm:w-72" />
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="sm:w-48" aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <DemoDataNote className="sm:ml-auto" />
        </Toolbar>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={setSel}
          columns={[
            { key: "title", header: "Ocorrência", primary: true, cell: (o) => <span className="font-medium text-navy-900">{o.title}</span> },
            { key: "cat", header: "Categoria", cell: (o) => o.category },
            { key: "loc", header: "Local", cell: (o) => o.location, hideOnMobile: true },
            { key: "date", header: "Data", cell: (o) => formatDateTime(o.createdAt) },
            { key: "prio", header: "Prioridade", cell: (o) => <StatusBadge status={o.priority} /> },
            { key: "status", header: "Estado", cell: (o) => <StatusBadge status={o.status} /> },
          ]}
        />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Registar ocorrência" footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" form="occ-form">Registar</Button></>}>
        <form id="occ-form" onSubmit={handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Título" required error={errors.title?.message} className="sm:col-span-2">
            <Input {...register("title")} invalid={!!errors.title} />
          </Field>
          <Field label="Categoria">
            <Select {...register("category")}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
          </Field>
          <Field label="Prioridade">
            <Select {...register("priority")}>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </Select>
          </Field>
          <Field label="Local" required error={errors.location?.message}>
            <Input {...register("location")} />
          </Field>
          <Field label="Apartamento (opcional)">
            <Select {...register("apartmentId")}>
              <option value="">—</option>
              {apartments.map((a) => <option key={a.id} value={a.id}>{a.block}-{a.number}</option>)}
            </Select>
          </Field>
          <Field label="Descrição" required error={errors.description?.message} className="sm:col-span-2">
            <Textarea rows={4} {...register("description")} invalid={!!errors.description} />
          </Field>
        </form>
      </Modal>

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.title} description={sel ? `${sel.category} · ${sel.location}` : ""}>
        {sel && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={sel.status} />
              <StatusBadge status={sel.priority} />
            </div>
            <p className="rounded-xl bg-graphite-50 p-4 text-graphite-700">{sel.description}</p>
            <dl className="grid grid-cols-2 gap-3">
              <div><dt className="text-xs text-graphite-500">Registada em</dt><dd className="font-medium">{formatDateTime(sel.createdAt)}</dd></div>
              <div><dt className="text-xs text-graphite-500">Reportada por</dt><dd className="font-medium">{sel.reportedBy}</dd></div>
              <div><dt className="text-xs text-graphite-500">Apartamento</dt><dd className="font-medium">{aptLabel(apartments, sel.apartmentId)}</dd></div>
            </dl>
            <div className="flex flex-wrap gap-2 border-t border-graphite-100 pt-4">
              <ShieldAlert className="h-4 w-4 text-graphite-400" />
              <span className="text-xs text-graphite-500">Actualizar estado:</span>
              {(["aberta", "em_curso", "resolvida"] as const).map((s) => (
                <Button key={s} size="sm" variant={sel.status === s ? "primary" : "outline"} onClick={() => setStatus(sel, s)}>
                  {s === "aberta" ? "Aberta" : s === "em_curso" ? "Em curso" : "Resolvida"}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
