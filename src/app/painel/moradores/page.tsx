"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, Mail, Pencil, Phone, Plus, Trash2, UserPlus, Users, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type { Resident } from "@/types";
import { useDemoStore, aptLabel } from "@/store/demo-store";
import { useSession } from "@/hooks/use-session";
import { can } from "@/config/permissions";
import { formatDate, includesText, uid } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Toolbar } from "@/components/ui/toolbar";
import { Tabs } from "@/components/ui/tabs";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { IconBtn } from "@/components/ui/icon-button";

const schema = z.object({
  name: z.string().min(3, "Indique o nome completo."),
  email: z.email("Email inválido."),
  phone: z.string().min(9, "Telefone inválido."),
  documentId: z.string().min(5, "Indique o n.º do documento."),
  apartmentId: z.string().optional(),
  type: z.enum(["proprietario", "inquilino"]),
  status: z.enum(["activo", "inactivo"]),
  since: z.string().min(1, "Indique a data."),
  notes: z.string().optional(),
  dependents: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(2, "Nome obrigatório."),
      relation: z.enum(["Cônjuge", "Filho(a)", "Pai/Mãe", "Outro"]),
      birthYear: z.coerce.number<number>().int().min(1900).max(2026).optional(),
    }),
  ),
});
type FormData = z.infer<typeof schema>;

export default function MoradoresPage() {
  const params = useSearchParams();
  const residents = useDemoStore((s) => s.residents);
  const apartments = useDemoStore((s) => s.apartments);
  const saveResident = useDemoStore((s) => s.saveResident);
  const deleteResident = useDemoStore((s) => s.deleteResident);
  const session = useSession();
  const canManage = can(session?.role, "residents.manage");

  const [q, setQ] = useState(params.get("q") ?? "");
  const [tab, setTab] = useState<"todos" | "activo" | "inactivo">("todos");
  const [type, setType] = useState("");
  const [editing, setEditing] = useState<Resident | "new" | null>(null);
  const [viewing, setViewing] = useState<Resident | null>(null);
  const [deleting, setDeleting] = useState<Resident | null>(null);

  const rows = useMemo(
    () =>
      residents
        .filter((r) => (tab === "todos" || r.status === tab) && (!type || r.type === type))
        .filter((r) => includesText([r.name, r.email, r.phone, aptLabel(apartments, r.apartmentId)], q))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [residents, apartments, tab, type, q],
  );

  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title="Moradores"
        description={canManage ? "Cadastro, perfis, associação a apartamentos e dependentes." : "Consulta de moradores e contactos para a gestão operacional."}
        actions={
          canManage && (
            <Button onClick={() => setEditing("new")}>
              <UserPlus className="h-4 w-4" /> Novo morador
            </Button>
          )
        }
      />
      <Card>
        <Toolbar>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "todos", label: "Todos", count: residents.length },
              { id: "activo", label: "Activos", count: residents.filter((r) => r.status === "activo").length },
              { id: "inactivo", label: "Inactivos", count: residents.filter((r) => r.status === "inactivo").length },
            ]}
          />
          <SearchInput value={q} onChange={setQ} placeholder="Nome, email, telefone ou apartamento…" className="sm:w-72" />
          <Select value={type} onChange={(e) => setType(e.target.value)} className="sm:w-44" aria-label="Tipo de morador">
            <option value="">Todos os tipos</option>
            <option value="proprietario">Proprietários</option>
            <option value="inquilino">Inquilinos</option>
          </Select>
          <DemoDataNote className="sm:ml-auto" />
        </Toolbar>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={setViewing}
          columns={[
            {
              key: "name",
              header: "Morador",
              primary: true,
              cell: (r) => (
                <span className="flex items-center gap-3">
                  <Avatar name={r.name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-navy-900">{r.name}</span>
                    <span className="block truncate text-xs text-graphite-500">{r.email}</span>
                  </span>
                </span>
              ),
            },
            { key: "apt", header: "Apartamento", cell: (r) => <span className="font-medium">{aptLabel(apartments, r.apartmentId)}</span> },
            { key: "type", header: "Tipo", cell: (r) => <Badge tone={r.type === "proprietario" ? "gold" : "navy"}>{r.type === "proprietario" ? "Proprietário" : "Inquilino"}</Badge> },
            { key: "phone", header: "Telefone", cell: (r) => r.phone, hideOnMobile: true },
            { key: "deps", header: "Dependentes", align: "center", cell: (r) => r.dependents.length, hideOnMobile: true },
            { key: "status", header: "Estado", cell: (r) => <StatusBadge status={r.status} /> },
            {
              key: "actions",
              header: "",
              align: "right",
              cell: (r) => (
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <IconBtn label="Ver perfil" onClick={() => setViewing(r)}>
                    <Eye className="h-4 w-4" />
                  </IconBtn>
                  {canManage && (
                    <>
                      <IconBtn label="Editar" onClick={() => setEditing(r)}>
                        <Pencil className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn label="Eliminar" danger onClick={() => setDeleting(r)}>
                        <Trash2 className="h-4 w-4" />
                      </IconBtn>
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      <ResidentForm
        key={editing === "new" ? "new" : editing?.id ?? "closed"}
        open={editing !== null}
        resident={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSave={(r) => {
          const exists = residents.some((x) => x.id === r.id);
          saveResident(r);
          toast.success(exists ? "Morador actualizado" : "Morador registado", { description: "Alterações locais (demo)." });
          setEditing(null);
        }}
      />

      <Modal open={!!viewing} onClose={() => setViewing(null)} size="lg" title="Perfil do morador" footer={viewing && canManage && <Button onClick={() => { setEditing(viewing); setViewing(null); }}><Pencil className="h-4 w-4" /> Editar</Button>}>
        {viewing && (
          <div>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={viewing.name} size="lg" />
              <div>
                <p className="font-display text-2xl text-navy-900">{viewing.name}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <StatusBadge status={viewing.status} />
                  <Badge tone={viewing.type === "proprietario" ? "gold" : "navy"}>{viewing.type === "proprietario" ? "Proprietário" : "Inquilino"}</Badge>
                  <Badge>Apartamento {aptLabel(apartments, viewing.apartmentId)}</Badge>
                </div>
              </div>
            </div>
            <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <p className="flex items-center gap-2 rounded-xl bg-graphite-50 p-3"><Mail className="h-4 w-4 text-gold-600" /> {viewing.email}</p>
              <p className="flex items-center gap-2 rounded-xl bg-graphite-50 p-3"><Phone className="h-4 w-4 text-gold-600" /> {viewing.phone}</p>
              <p className="rounded-xl bg-graphite-50 p-3"><span className="block text-xs text-graphite-500">Documento</span>{viewing.documentId}</p>
              <p className="rounded-xl bg-graphite-50 p-3"><span className="block text-xs text-graphite-500">Morador desde</span>{formatDate(viewing.since)}</p>
            </div>
            <h4 className="mt-6 mb-3 flex items-center gap-2 text-sm font-semibold text-navy-900"><Users className="h-4 w-4" /> Dependentes ({viewing.dependents.length})</h4>
            {viewing.dependents.length === 0 ? (
              <p className="text-sm text-graphite-500">Sem dependentes registados.</p>
            ) : (
              <ul className="divide-y divide-graphite-100 rounded-xl border border-graphite-100">
                {viewing.dependents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="font-medium text-navy-900">{d.name}</span>
                    <span className="text-graphite-500">{d.relation}{d.birthYear ? ` · ${d.birthYear}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Eliminar ${deleting?.name}?`}
        description="O morador será removido e desassociado do apartamento (apenas localmente)."
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deleting) deleteResident(deleting.id);
          toast.success("Morador eliminado (demo).");
        }}
      />
    </>
  );
}

function ResidentForm({ open, resident, onClose, onSave }: { open: boolean; resident: Resident | null; onClose: () => void; onSave: (r: Resident) => void }) {
  const apartments = useDemoStore((s) => s.apartments);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: resident
      ? { ...resident, apartmentId: resident.apartmentId ?? "", notes: resident.notes ?? "" }
      : { name: "", email: "", phone: "+244 ", documentId: "", apartmentId: "", type: "proprietario", status: "activo", since: "2026-10-18", notes: "", dependents: [] },
  });
  const deps = useFieldArray({ control, name: "dependents" });

  const submit = (d: FormData) =>
    onSave({
      ...d,
      id: resident?.id ?? uid("res"),
      apartmentId: d.apartmentId || undefined,
      notes: d.notes || undefined,
    });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={resident ? "Editar morador" : "Novo morador"}
      description="Dados guardados apenas no browser (demonstração)."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="res-form">Guardar morador</Button>
        </>
      }
    >
      <form id="res-form" onSubmit={handleSubmit(submit)} noValidate>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nome completo" required error={errors.name?.message} className="lg:col-span-2">
            <Input {...register("name")} invalid={!!errors.name} />
          </Field>
          <Field label="Documento de identificação" required error={errors.documentId?.message}>
            <Input {...register("documentId")} invalid={!!errors.documentId} />
          </Field>
          <Field label="Email" required error={errors.email?.message}>
            <Input type="email" {...register("email")} invalid={!!errors.email} />
          </Field>
          <Field label="Telefone" required error={errors.phone?.message}>
            <Input type="tel" {...register("phone")} invalid={!!errors.phone} />
          </Field>
          <Field label="Apartamento">
            <Select {...register("apartmentId")}>
              <option value="">— Não associado —</option>
              {apartments.map((a) => (
                <option key={a.id} value={a.id}>
                  Bloco {a.block} · {a.number}{a.typology ? ` · ${a.typology}` : ""} {a.status !== "ocupado" ? "(livre)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tipo">
            <Select {...register("type")}>
              <option value="proprietario">Proprietário</option>
              <option value="inquilino">Inquilino</option>
            </Select>
          </Field>
          <Field label="Estado">
            <Select {...register("status")}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </Select>
          </Field>
          <Field label="Morador desde" required error={errors.since?.message}>
            <Input type="date" {...register("since")} />
          </Field>
          <Field label="Observações" className="sm:col-span-2 lg:col-span-3">
            <Textarea rows={2} {...register("notes")} />
          </Field>
        </div>

        <div className="mt-6 rounded-2xl border border-graphite-100 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-navy-900">Dependentes</p>
            <Button size="sm" variant="subtle" onClick={() => deps.append({ id: uid("dep"), name: "", relation: "Filho(a)", birthYear: undefined })}>
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
          {deps.fields.length === 0 && <p className="text-sm text-graphite-500">Sem dependentes.</p>}
          <div className="space-y-3">
            {deps.fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
                <Input placeholder="Nome" {...register(`dependents.${i}.name`)} invalid={!!errors.dependents?.[i]?.name} className="col-span-2 sm:col-span-1" />
                <Select {...register(`dependents.${i}.relation`)}>
                  {["Cônjuge", "Filho(a)", "Pai/Mãe", "Outro"].map((r) => <option key={r}>{r}</option>)}
                </Select>
                <Input type="number" placeholder="Ano nasc." {...register(`dependents.${i}.birthYear`, { setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)) })} />
                <button type="button" onClick={() => deps.remove(i)} className="rounded-lg p-2 text-graphite-400 hover:bg-red-50 hover:text-red-600" aria-label="Remover dependente">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
