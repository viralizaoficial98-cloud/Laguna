"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type { Apartment } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { QUOTA_BY_TYPOLOGY } from "@/data/management";
import { cn, formatKz, includesText } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { Toolbar } from "@/components/ui/toolbar";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { IconBtn } from "@/components/ui/icon-button";

const schema = z.object({
  block: z.string().min(1, "Indique o bloco."),
  number: z.string().regex(/^\d{3}$/, "Use 3 dígitos (ex.: 302)."),
  typology: z.enum(["T1", "T2", "T3", "T4"]),
  floor: z.coerce.number<number>().int().min(0, "Andar inválido.").max(30, "Andar inválido."),
  status: z.enum(["ocupado", "disponivel", "manutencao"]),
  ownerName: z.string().min(3, "Indique o proprietário."),
  residentId: z.string().optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function ApartamentosPage() {
  const params = useSearchParams();
  const apartments = useDemoStore((s) => s.apartments);
  const residents = useDemoStore((s) => s.residents);
  const saveApartment = useDemoStore((s) => s.saveApartment);
  const deleteApartment = useDemoStore((s) => s.deleteApartment);

  const [q, setQ] = useState(params.get("q") ?? "");
  const [block, setBlock] = useState("");
  const [typology, setTypology] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Apartment | "new" | null>(null);
  const [viewing, setViewing] = useState<Apartment | null>(null);
  const [deleting, setDeleting] = useState<Apartment | null>(null);

  const blocks = useMemo(() => Array.from(new Set(apartments.map((a) => a.block))).sort(), [apartments]);
  const resName = (id?: string) => residents.find((r) => r.id === id)?.name;

  const rows = useMemo(
    () =>
      apartments
        .filter((a) => (!block || a.block === block) && (!typology || a.typology === typology) && (!status || a.status === status))
        .filter((a) => includesText([`${a.block}-${a.number}`, `${a.block}${a.number}`, a.ownerName, resName(a.residentId)], q))
        .sort((a, b) => (a.block + a.number).localeCompare(b.block + b.number)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apartments, residents, block, typology, status, q],
  );

  const counts = {
    ocupado: apartments.filter((a) => a.status === "ocupado").length,
    disponivel: apartments.filter((a) => a.status === "disponivel").length,
    manutencao: apartments.filter((a) => a.status === "manutencao").length,
  };

  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title="Apartamentos"
        description="Listagem, cadastro e edição de apartamentos, blocos, tipologias e estado de ocupação."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Novo apartamento
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total", value: apartments.length, s: "" },
          { label: "Ocupados", value: counts.ocupado, s: "ocupado" },
          { label: "Disponíveis", value: counts.disponivel, s: "disponivel" },
          { label: "Em manutenção", value: counts.manutencao, s: "manutencao" },
        ].map((c) => (
          <button
            key={c.label}
            onClick={() => setStatus(c.s)}
            className={cn("rounded-2xl border bg-white p-4 text-left shadow-soft transition hover:-translate-y-0.5", status === c.s ? "border-navy-900 ring-2 ring-navy-100" : "border-graphite-100")}
          >
            <p className="text-xs text-graphite-500">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold text-navy-900 tabular-nums">{c.value}</p>
          </button>
        ))}
      </div>

      <Card>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Pesquisar por número, proprietário ou morador…" className="sm:w-80" />
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <Select value={block} onChange={(e) => setBlock(e.target.value)} aria-label="Filtrar por bloco" className="sm:w-36">
              <option value="">Todos os blocos</option>
              {blocks.map((b) => (
                <option key={b} value={b}>
                  Bloco {b}
                </option>
              ))}
            </Select>
            <Select value={typology} onChange={(e) => setTypology(e.target.value)} aria-label="Filtrar por tipologia" className="sm:w-36">
              <option value="">Tipologias</option>
              {["T1", "T2", "T3", "T4"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar por estado" className="sm:w-40">
              <option value="">Estados</option>
              <option value="ocupado">Ocupado</option>
              <option value="disponivel">Disponível</option>
              <option value="manutencao">Manutenção</option>
            </Select>
          </div>
          <DemoDataNote className="sm:ml-auto" />
        </Toolbar>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={setViewing}
          columns={[
            {
              key: "apt",
              header: "Apartamento",
              primary: true,
              cell: (a) => (
                <span className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-50 text-xs font-bold text-navy-800">{a.block}</span>
                  <span>
                    <span className="block font-semibold text-navy-900">
                      {a.block}-{a.number}
                    </span>
                    <span className="block text-xs text-graphite-500">{a.floor}.º andar</span>
                  </span>
                </span>
              ),
            },
            { key: "typology", header: "Tipologia", cell: (a) => <span className="font-medium">{a.typology}</span> },
            { key: "owner", header: "Proprietário", cell: (a) => a.ownerName },
            { key: "resident", header: "Morador responsável", cell: (a) => resName(a.residentId) ?? <span className="text-graphite-400">—</span>, hideOnMobile: true },
            { key: "quota", header: "Quota", align: "right", cell: (a) => <span className="tabular-nums">{formatKz(a.monthlyQuota)}</span>, hideOnMobile: true },
            { key: "status", header: "Estado", cell: (a) => <StatusBadge status={a.status} /> },
            {
              key: "actions",
              header: "",
              align: "right",
              cell: (a) => (
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <IconBtn label="Ver detalhes" onClick={() => setViewing(a)}>
                    <Eye className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn label="Editar" onClick={() => setEditing(a)}>
                    <Pencil className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn label="Eliminar" danger onClick={() => setDeleting(a)}>
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <ApartmentForm
        key={editing === "new" ? "new" : editing?.id ?? "closed"}
        open={editing !== null}
        apartment={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSave={(apt) => {
          const exists = apartments.some((a) => a.id === apt.id);
          saveApartment(apt);
          toast.success(exists ? "Apartamento actualizado" : "Apartamento criado", { description: `${apt.block}-${apt.number} · alterações locais (demo).` });
          setEditing(null);
        }}
      />

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `Apartamento ${viewing.block}-${viewing.number}` : ""} description="Detalhes do apartamento" footer={
        viewing && (
          <Button onClick={() => { setEditing(viewing); setViewing(null); }}>
            <Pencil className="h-4 w-4" /> Editar
          </Button>
        )
      }>
        {viewing && (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {[
              ["Bloco", viewing.block],
              ["Número", viewing.number],
              ["Andar", `${viewing.floor}.º`],
              ["Tipologia", viewing.typology],
              ["Estado", <StatusBadge key="s" status={viewing.status} />],
              ["Quota mensal", formatKz(viewing.monthlyQuota)],
              ["Proprietário", viewing.ownerName],
              ["Morador responsável", resName(viewing.residentId) ?? "—"],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-xl bg-graphite-50 p-3">
                <dt className="text-xs text-graphite-500">{k}</dt>
                <dd className="mt-0.5 font-medium text-navy-900">{v}</dd>
              </div>
            ))}
            <div className="col-span-2 rounded-xl bg-graphite-50 p-3">
              <dt className="text-xs text-graphite-500">Observações</dt>
              <dd className="mt-0.5 text-graphite-700">{viewing.notes || "Sem observações."}</dd>
            </div>
          </dl>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Eliminar apartamento ${deleting?.block}-${deleting?.number}?`}
        description="A alteração é apenas local (demonstração) e pode ser revertida repondo os dados de demonstração."
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deleting) deleteApartment(deleting.id);
          toast.success("Apartamento eliminado (demo).");
        }}
      />
    </>
  );
}

function ApartmentForm({ open, apartment, onClose, onSave }: { open: boolean; apartment: Apartment | null; onClose: () => void; onSave: (a: Apartment) => void }) {
  const residents = useDemoStore((s) => s.residents);
  const apartments = useDemoStore((s) => s.apartments);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: apartment
      ? { ...apartment, residentId: apartment.residentId ?? "", notes: apartment.notes ?? "" }
      : { block: "A", number: "", typology: "T2", floor: 1, status: "disponivel", ownerName: "", residentId: "", notes: "" },
  });

  const submit = (d: FormData) => {
    const id = apartment?.id ?? `apt_${d.block}${d.number}`;
    if (!apartment && apartments.some((a) => a.id === id)) {
      setError("number", { message: "Já existe um apartamento com este número neste bloco." });
      return;
    }
    onSave({
      id,
      block: d.block.toUpperCase(),
      number: d.number,
      floor: d.floor,
      typology: d.typology,
      status: d.status,
      ownerName: d.ownerName,
      residentId: d.residentId || undefined,
      notes: d.notes || undefined,
      monthlyQuota: QUOTA_BY_TYPOLOGY[d.typology],
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={apartment ? `Editar ${apartment.block}-${apartment.number}` : "Novo apartamento"}
      description="Os dados são guardados apenas no browser (demonstração)."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="apt-form">
            <Building2 className="h-4 w-4" /> Guardar
          </Button>
        </>
      }
    >
      <form id="apt-form" onSubmit={handleSubmit(submit)} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Bloco" required error={errors.block?.message}>
          <Input {...register("block")} disabled={!!apartment} invalid={!!errors.block} />
        </Field>
        <Field label="Número do apartamento" required error={errors.number?.message}>
          <Input {...register("number")} disabled={!!apartment} placeholder="302" invalid={!!errors.number} />
        </Field>
        <Field label="Tipologia" required>
          <Select {...register("typology")}>
            {["T1", "T2", "T3", "T4"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Andar" required error={errors.floor?.message}>
          <Input type="number" {...register("floor")} invalid={!!errors.floor} />
        </Field>
        <Field label="Estado" required>
          <Select {...register("status")}>
            <option value="ocupado">Ocupado</option>
            <option value="disponivel">Disponível</option>
            <option value="manutencao">Manutenção</option>
          </Select>
        </Field>
        <Field label="Proprietário" required error={errors.ownerName?.message}>
          <Input {...register("ownerName")} invalid={!!errors.ownerName} />
        </Field>
        <Field label="Morador responsável" className="sm:col-span-2">
          <Select {...register("residentId")}>
            <option value="">— Sem morador associado —</option>
            {residents.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <Textarea rows={3} {...register("notes")} />
        </Field>
      </form>
    </Modal>
  );
}
