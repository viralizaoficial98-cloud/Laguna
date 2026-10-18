"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn, LogOut, UserPlus, Ban } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type { VisitStatus } from "@/types";
import { useDemoStore, aptLabel } from "@/store/demo-store";
import { useSession } from "@/hooks/use-session";
import { formatDate, formatTime, includesText, uid } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Field, Input, Select } from "@/components/ui/field";
import { Toolbar } from "@/components/ui/toolbar";
import { Tabs } from "@/components/ui/tabs";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { IconBtn } from "@/components/ui/icon-button";
import { DemoDataNote } from "@/components/ui/demo-badge";

const schema = z.object({
  name: z.string().min(3, "Indique o nome do visitante."),
  documentId: z.string().min(1, "Indique o documento (ou “—”)."),
  apartmentId: z.string().min(1, "Seleccione o apartamento de destino."),
  reason: z.string().min(1),
  vehiclePlate: z.string().optional(),
  status: z.enum(["no_interior", "aguardando"]),
});
type FormData = z.infer<typeof schema>;

export default function PortariaPage() {
  const params = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const visitors = useDemoStore((s) => s.visitors);
  const apartments = useDemoStore((s) => s.apartments);
  const saveVisitor = useDemoStore((s) => s.saveVisitor);
  const checkout = useDemoStore((s) => s.checkoutVisitor);
  const [tab, setTab] = useState<"todos" | VisitStatus>("todos");
  const [q, setQ] = useState("");
  const [date, setDate] = useState("");
  const [open, setOpen] = useState(params.get("novo") === "1");

  const rows = useMemo(
    () =>
      visitors
        .filter((v) => (tab === "todos" || v.status === tab) && (!date || v.entryAt.startsWith(date)))
        .filter((v) => includesText([v.name, v.documentId, aptLabel(apartments, v.apartmentId), v.vehiclePlate], q))
        .sort((a, b) => b.entryAt.localeCompare(a.entryAt)),
    [visitors, tab, date, q, apartments],
  );
  const count = (s: VisitStatus) => visitors.filter((v) => v.status === s).length;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { reason: "Visita pessoal", status: "no_interior", apartmentId: "", documentId: "", name: "" } });

  const close = () => {
    setOpen(false);
    reset();
    if (params.get("novo")) router.replace("/painel/portaria");
  };

  const submit = (d: FormData) => {
    saveVisitor({ ...d, id: uid("vis"), vehiclePlate: d.vehiclePlate || undefined, entryAt: new Date().toISOString(), registeredBy: session?.name ?? "Portaria" });
    toast.success(`Visitante registado: ${d.name}`, { description: d.status === "no_interior" ? "Entrada registada." : "A aguardar autorização do morador." });
    close();
  };

  return (
    <>
      <PageHeader
        eyebrow="Portaria"
        title="Visitantes"
        description="Registo de entradas e saídas na entrada principal."
        actions={
          <Button onClick={() => setOpen(true)}>
            <UserPlus className="h-4 w-4" /> Registar visitante
          </Button>
        }
      />
      <Card>
        <Toolbar>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "todos", label: "Todos", count: visitors.length },
              { id: "no_interior", label: "No interior", count: count("no_interior") },
              { id: "aguardando", label: "A aguardar", count: count("aguardando") },
              { id: "saiu", label: "Saíram", count: count("saiu") },
              { id: "recusado", label: "Recusados", count: count("recusado") },
            ]}
          />
        </Toolbar>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Nome, documento, apartamento ou matrícula…" className="sm:w-80" />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:w-44" aria-label="Filtrar por data" />
          <DemoDataNote className="sm:ml-auto" />
        </Toolbar>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            {
              key: "name",
              header: "Visitante",
              primary: true,
              cell: (v) => (
                <span>
                  <span className="block font-medium text-navy-900">{v.name}</span>
                  <span className="block text-xs text-graphite-500">Doc. {v.documentId}</span>
                </span>
              ),
            },
            { key: "apt", header: "Destino", cell: (v) => <span className="font-semibold">{aptLabel(apartments, v.apartmentId)}</span> },
            { key: "reason", header: "Motivo", cell: (v) => v.reason, hideOnMobile: true },
            { key: "plate", header: "Viatura", cell: (v) => v.vehiclePlate ?? "—", hideOnMobile: true },
            { key: "entry", header: "Entrada", cell: (v) => `${formatDate(v.entryAt, { day: "2-digit", month: "2-digit" })} ${formatTime(v.entryAt)}` },
            { key: "exit", header: "Saída", cell: (v) => (v.exitAt ? formatTime(v.exitAt) : "—") },
            { key: "status", header: "Estado", cell: (v) => <StatusBadge status={v.status} /> },
            {
              key: "actions",
              header: "",
              align: "right",
              cell: (v) => (
                <div className="flex justify-end gap-1">
                  {v.status === "aguardando" && (
                    <>
                      <IconBtn label="Autorizar entrada" onClick={() => { saveVisitor({ ...v, status: "no_interior", entryAt: new Date().toISOString() }); toast.success(`Entrada autorizada: ${v.name}`); }}>
                        <LogIn className="h-4 w-4 text-emerald-700" />
                      </IconBtn>
                      <IconBtn label="Recusar" danger onClick={() => { saveVisitor({ ...v, status: "recusado" }); toast.info(`Entrada recusada: ${v.name}`); }}>
                        <Ban className="h-4 w-4" />
                      </IconBtn>
                    </>
                  )}
                  {v.status === "no_interior" && (
                    <IconBtn label="Registar saída" onClick={() => { checkout(v.id); toast.success(`Saída registada: ${v.name}`); }}>
                      <LogOut className="h-4 w-4" />
                    </IconBtn>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={open}
        onClose={close}
        title="Registar visitante"
        description="Registo demonstrativo na entrada principal."
        footer={
          <>
            <Button variant="outline" onClick={close}>Cancelar</Button>
            <Button type="submit" form="visitor-form">Registar</Button>
          </>
        }
      >
        <form id="visitor-form" onSubmit={handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Nome do visitante" required error={errors.name?.message} className="sm:col-span-2">
            <Input {...register("name")} invalid={!!errors.name} autoFocus />
          </Field>
          <Field label="Documento de identificação" required error={errors.documentId?.message}>
            <Input {...register("documentId")} invalid={!!errors.documentId} />
          </Field>
          <Field label="Apartamento de destino" required error={errors.apartmentId?.message}>
            <Select {...register("apartmentId")} invalid={!!errors.apartmentId}>
              <option value="">Seleccione…</option>
              {apartments.filter((a) => a.status === "ocupado").map((a) => (
                <option key={a.id} value={a.id}>{a.block}-{a.number}</option>
              ))}
            </Select>
          </Field>
          <Field label="Motivo">
            <Select {...register("reason")}>
              {["Visita pessoal", "Visita familiar", "Prestação de serviço", "Entrega", "Manutenção", "Reunião"].map((r) => <option key={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label="Matrícula (opcional)">
            <Input {...register("vehiclePlate")} placeholder="LD-00-00-AA" />
          </Field>
          <Field label="Estado da visita" className="sm:col-span-2">
            <Select {...register("status")}>
              <option value="no_interior">Entrada autorizada — no interior</option>
              <option value="aguardando">A aguardar autorização do morador</option>
            </Select>
          </Field>
        </form>
      </Modal>
    </>
  );
}
