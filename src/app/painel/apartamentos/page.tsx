"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Eye, Info, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type { Apartment } from "@/types";
import { useDemoStore, formatApt } from "@/store/demo-store";
import { BLOCKS, TYPOLOGIES, aptId } from "@/data/management";
import { cn, includesText, uid } from "@/lib/utils";
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
import { Toolbar } from "@/components/ui/toolbar";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { IconBtn } from "@/components/ui/icon-button";

const schema = z.object({
  block: z.string().regex(/^\d{2}$/, "Use 2 dígitos (ex.: 06)."),
  number: z.string().regex(/^\d{3}$/, "Use 3 dígitos (ex.: 201)."),
  typology: z.enum(["", "T2", "T3", "T4"]),
  floor: z.coerce.number<number>().int().min(0, "Piso inválido.").max(30, "Piso inválido."),
  status: z.enum(["ocupado", "disponivel", "manutencao"]),
  active: z.boolean(),
  provisional: z.boolean(),
  ownerName: z.string(),
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

  const blocks = useMemo(() => Array.from(new Set([...BLOCKS, ...apartments.map((a) => a.block)])).sort(), [apartments]);
  const resName = (id?: string) => residents.find((r) => r.id === id)?.name;

  const rows = useMemo(
    () =>
      apartments
        .filter((a) => !block || a.block === block)
        .filter((a) => !typology || (typology === "none" ? !a.typology : a.typology === typology))
        .filter((a) => (status === "inactivo" ? !a.active : status ? a.active && a.status === status : true))
        .filter((a) => includesText([formatApt(a), `${a.block}-${a.number}`, `${a.block}${a.number}`, a.number, a.ownerName, resName(a.residentId)], q))
        .sort((a, b) => (a.block + a.number).localeCompare(b.block + b.number)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apartments, residents, block, typology, status, q],
  );

  const active = apartments.filter((a) => a.active);
  const counts = {
    ocupado: active.filter((a) => a.status === "ocupado").length,
    disponivel: active.filter((a) => a.status === "disponivel").length,
    manutencao: active.filter((a) => a.status === "manutencao").length,
    inactivo: apartments.length - active.length,
  };
  const provisional = apartments.filter((a) => a.provisional).length;

  const toggleActive = (a: Apartment) => {
    saveApartment({ ...a, active: !a.active });
    toast.success(a.active ? `${formatApt(a)} desactivado` : `${formatApt(a)} reactivado`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title="Blocos e apartamentos"
        description="Cadastro das fracções por bloco: numeração, tipologia, ocupação e associação de moradores."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Novo apartamento
          </Button>
        }
      />

      {provisional > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4 text-sm text-amber-900">
          <Info className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            <strong>Cadastro provisório:</strong> {provisional} fracções foram criadas com base na numeração observada nos documentos da Administração
            (Blocos 01 a 10, apartamentos 101 a 502). Não são unidades oficialmente confirmadas — valide cada fracção, corrija a numeração, defina a
            tipologia (T2, T3 ou T4) e desactive as inexistentes.
          </p>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Fracções activas", value: active.length, s: "" },
          { label: "Ocupadas", value: counts.ocupado, s: "ocupado" },
          { label: "Disponíveis", value: counts.disponivel, s: "disponivel" },
          { label: "Em manutenção", value: counts.manutencao, s: "manutencao" },
          { label: "Desactivadas", value: counts.inactivo, s: "inactivo" },
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
          <SearchInput value={q} onChange={setQ} placeholder="Pesquisar por apartamento, proprietário ou morador…" className="sm:w-80" />
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <Select value={block} onChange={(e) => setBlock(e.target.value)} aria-label="Filtrar por bloco" className="sm:w-36">
              <option value="">Todos os blocos</option>
              {blocks.map((b) => (
                <option key={b} value={b}>
                  Bloco {b}
                </option>
              ))}
            </Select>
            <Select value={typology} onChange={(e) => setTypology(e.target.value)} aria-label="Filtrar por tipologia" className="sm:w-40">
              <option value="">Tipologias</option>
              {TYPOLOGIES.map((t) => (
                <option key={t}>{t}</option>
              ))}
              <option value="none">Por definir</option>
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar por estado" className="sm:w-40">
              <option value="">Estados</option>
              <option value="ocupado">Ocupado</option>
              <option value="disponivel">Disponível</option>
              <option value="manutencao">Manutenção</option>
              <option value="inactivo">Desactivado</option>
            </Select>
          </div>
          <DemoDataNote className="sm:ml-auto">Ocupação e moradores fictícios</DemoDataNote>
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
                <span className={cn("flex items-center gap-2.5", !a.active && "opacity-50")}>
                  <span className="flex h-9 w-9 flex-col items-center justify-center rounded-xl bg-navy-50 leading-none text-navy-800">
                    <span className="text-[8px] font-semibold uppercase">Bl.</span>
                    <span className="text-xs font-bold">{a.block}</span>
                  </span>
                  <span>
                    <span className="block font-semibold text-navy-900">{a.number}</span>
                    <span className="block text-xs text-graphite-500">
                      Bloco {a.block} · {a.floor}.º piso
                    </span>
                  </span>
                </span>
              ),
            },
            { key: "typology", header: "Tipologia", cell: (a) => (a.typology ? <span className="font-medium">{a.typology}</span> : <span className="text-xs text-graphite-400 italic">Por definir</span>) },
            { key: "owner", header: "Proprietário", cell: (a) => a.ownerName || <span className="text-graphite-400">—</span> },
            { key: "resident", header: "Morador", cell: (a) => resName(a.residentId) ?? <span className="text-graphite-400">—</span>, hideOnMobile: true },
            {
              key: "status",
              header: "Estado",
              cell: (a) => (
                <span className="flex flex-wrap gap-1">
                  {a.active ? <StatusBadge status={a.status} /> : <Badge>Desactivado</Badge>}
                  {a.provisional && <Badge tone="warning">Provisório</Badge>}
                </span>
              ),
            },
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
                  <IconBtn label={a.active ? "Desactivar" : "Reactivar"} onClick={() => toggleActive(a)}>
                    <Power className={cn("h-4 w-4", a.active ? "" : "text-emerald-700")} />
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
          toast.success(exists ? "Apartamento actualizado" : "Apartamento adicionado", { description: `${formatApt(apt)} · alterações locais (demo).` });
          setEditing(null);
        }}
      />

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? formatApt(viewing) : ""}
        description="Detalhes da fracção"
        footer={
          viewing && (
            <Button
              onClick={() => {
                setEditing(viewing);
                setViewing(null);
              }}
            >
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          )
        }
      >
        {viewing && (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {[
              ["Bloco", viewing.block],
              ["Número", viewing.number],
              ["Piso", `${viewing.floor}.º`],
              ["Tipologia", viewing.typology ?? "Por definir"],
              ["Estado", viewing.active ? <StatusBadge key="s" status={viewing.status} /> : "Desactivado"],
              ["Cadastro", viewing.provisional ? "Provisório (por validar)" : "Validado"],
              ["Proprietário", viewing.ownerName || "—"],
              ["Morador associado", resName(viewing.residentId) ?? "—"],
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
        title={`Eliminar ${deleting ? formatApt(deleting) : ""}?`}
        description="Prefira desactivar fracções inexistentes para manter o histórico. Esta alteração é apenas local (demonstração)."
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
      ? { ...apartment, typology: apartment.typology ?? "", residentId: apartment.residentId ?? "", notes: apartment.notes ?? "" }
      : { block: "01", number: "", typology: "", floor: 1, status: "disponivel", active: true, provisional: false, ownerName: "", residentId: "", notes: "" },
  });

  const submit = (d: FormData) => {
    const duplicate = apartments.some((a) => a.block === d.block && a.number === d.number && a.id !== apartment?.id);
    if (duplicate) {
      setError("number", { message: `Já existe o apartamento ${d.number} no Bloco ${d.block}.` });
      return;
    }
    const id = apartment?.id ?? (apartments.some((a) => a.id === aptId(d.block, d.number)) ? uid("apt") : aptId(d.block, d.number));
    onSave({
      id,
      block: d.block,
      number: d.number,
      floor: d.floor,
      typology: d.typology || null,
      status: d.status,
      active: d.active,
      provisional: d.provisional,
      ownerName: d.ownerName,
      residentId: d.residentId || undefined,
      notes: d.notes || undefined,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={apartment ? `Editar ${formatApt(apartment)}` : "Novo apartamento"}
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
          <Select {...register("block")} invalid={!!errors.block}>
            {BLOCKS.map((b) => (
              <option key={b} value={b}>
                Bloco {b}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Número do apartamento" required error={errors.number?.message} hint="Ex.: 101, 102, 201…">
          <Input {...register("number")} placeholder="201" invalid={!!errors.number} />
        </Field>
        <Field label="Tipologia" hint="Apenas T2, T3 ou T4">
          <Select {...register("typology")}>
            <option value="">Por definir</option>
            {TYPOLOGIES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Piso" required error={errors.floor?.message}>
          <Input type="number" {...register("floor")} invalid={!!errors.floor} />
        </Field>
        <Field label="Estado de ocupação" required>
          <Select {...register("status")}>
            <option value="ocupado">Ocupado</option>
            <option value="disponivel">Disponível</option>
            <option value="manutencao">Manutenção</option>
          </Select>
        </Field>
        <Field label="Proprietário">
          <Input {...register("ownerName")} />
        </Field>
        <Field label="Morador associado" className="sm:col-span-2">
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
          <Textarea rows={2} {...register("notes")} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-graphite-700">
          <input type="checkbox" className="h-4 w-4 accent-navy-900" {...register("active")} /> Fracção activa (existente)
        </label>
        <label className="flex items-center gap-2 text-sm text-graphite-700">
          <input type="checkbox" className="h-4 w-4 accent-navy-900" {...register("provisional")} /> Cadastro provisório (por validar)
        </label>
      </form>
    </Modal>
  );
}
