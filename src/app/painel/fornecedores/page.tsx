"use client";

import { Archive, ArchiveRestore, Pencil, Plus, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Supplier } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { useSession } from "@/hooks/use-session";
import { can } from "@/config/permissions";
import { downloadXlsx } from "@/lib/excel-export";
import { formatDate, formatKz, includesText } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import { Toolbar } from "@/components/ui/toolbar";
import { StatCard } from "@/components/ui/stat-card";
import { IconBtn } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";

export default function FornecedoresPage() {
  const session = useSession();
  const suppliers = useDemoStore((s) => s.suppliers);
  const expenses = useDemoStore((s) => s.expenses);
  const archive = useDemoStore((s) => s.archiveSupplier);
  const manage = can(session?.role, "suppliers.manage");
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [edit, setEdit] = useState<Supplier | "new" | null>(null);
  const stats = useMemo(() => {
    const m = new Map<string, { n: number; total: number; last?: string }>();
    for (const e of expenses.filter((x) => x.status !== "anulada" && x.supplierId)) {
      const s = m.get(e.supplierId!) ?? { n: 0, total: 0 };
      s.n++;
      s.total += e.amount;
      if (!s.last || e.date > s.last) s.last = e.date;
      m.set(e.supplierId!, s);
    }
    return m;
  }, [expenses]);
  const rows = suppliers.filter((s) => (showArchived || s.active) && includesText([s.name, s.nif, s.category, s.email, s.phone], q)).sort((a, b) => (stats.get(b.id)?.total ?? 0) - (stats.get(a.id)?.total ?? 0));
  return (
    <>
      <PageHeader
        eyebrow="Gestão Financeira"
        title="Fornecedores"
        description="Fornecedores e beneficiários de despesas. NIF e contactos facultativos; sem duplicação por NIF."
        actions={
          <div className="flex gap-2">
            {manage && (
              <Button onClick={() => setEdit("new")}>
                <Plus className="h-4 w-4" /> Novo fornecedor
              </Button>
            )}
            <Button variant="outline" onClick={() => void downloadXlsx("laguna-fornecedores.xlsx", [{ name: "Fornecedores", head: ["Nome", "NIF", "Categoria", "Email", "Telefone", "Despesas", "Total (Kz)"], rows: rows.map((s) => [s.name, s.nif ?? "", s.category ?? "", s.email ?? "", s.phone ?? "", stats.get(s.id)?.n ?? 0, stats.get(s.id)?.total ?? 0]), money: [6] }])}>
              Excel
            </Button>
          </div>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard index={0} highlight label="Fornecedores activos" value={suppliers.filter((s) => s.active).length} icon={Truck} />
        <StatCard index={1} label="Com despesas registadas" value={stats.size} icon={Truck} tone="info" />
        <StatCard index={2} label="Total de despesas" value={formatKz([...stats.values()].reduce((a, s) => a + s.total, 0))} icon={Truck} tone="gold" />
      </div>
      <Card>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Nome, NIF, categoria…" className="sm:w-72" />
          <label className="flex items-center gap-2 text-xs text-graphite-600 sm:ml-auto">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Mostrar arquivados
          </label>
        </Toolbar>
        <DataTable
          rows={rows}
          rowKey={(s) => s.id}
          pageSize={20}
          columns={[
            { key: "n", header: "Fornecedor", primary: true, cell: (s) => <span className="font-medium text-navy-900">{s.name}{!s.active && <Badge tone="neutral" className="ml-2">Arquivado</Badge>}</span> },
            { key: "nif", header: "NIF", cell: (s) => s.nif ?? <span className="text-graphite-400">—</span> },
            { key: "c", header: "Contactos", hideOnMobile: true, cell: (s) => [s.phone, s.email].filter(Boolean).join(" · ") || <span className="text-graphite-400">—</span> },
            { key: "d", header: "Despesas", align: "right", cell: (s) => stats.get(s.id)?.n ?? 0 },
            { key: "t", header: "Total", align: "right", cell: (s) => formatKz(stats.get(s.id)?.total ?? 0) },
            { key: "l", header: "Última", hideOnMobile: true, cell: (s) => (stats.get(s.id)?.last ? formatDate(stats.get(s.id)!.last!) : "—") },
            ...(manage
              ? [
                  {
                    key: "x",
                    header: "",
                    align: "right" as const,
                    cell: (s: Supplier) => (
                      <div className="flex justify-end gap-0.5">
                        <IconBtn label="Editar" onClick={() => setEdit(s)}>
                          <Pencil className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn
                          label={s.active ? "Arquivar" : "Reactivar"}
                          onClick={() => {
                            try {
                              archive(s.id, s.active);
                              toast.success(s.active ? "Fornecedor arquivado." : "Fornecedor reactivado.");
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Erro");
                            }
                          }}
                        >
                          {s.active ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                        </IconBtn>
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>
      {edit && <SupplierForm supplier={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function SupplierForm({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const save = useDemoStore((s) => s.saveSupplier);
  const [f, setF] = useState({ name: supplier?.name ?? "", nif: supplier?.nif ?? "", category: supplier?.category ?? "", email: supplier?.email ?? "", phone: supplier?.phone ?? "", address: supplier?.address ?? "", notes: supplier?.notes ?? "" });
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={supplier ? `Editar — ${supplier.name}` : "Novo fornecedor"}
      description="Apenas o nome é obrigatório."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              try {
                save({ ...(supplier ?? { id: "", active: true, createdAt: "" }), name: f.name, nif: f.nif || undefined, category: f.category || undefined, email: f.email || undefined, phone: f.phone || undefined, address: f.address || undefined, notes: f.notes || undefined });
                toast.success("Fornecedor guardado.");
                onClose();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Erro");
              }
            }}
          >
            Guardar
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" required className="sm:col-span-2">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        {(
          [
            ["nif", "NIF"],
            ["category", "Categoria / serviço"],
            ["email", "Email"],
            ["phone", "Telefone"],
          ] as const
        ).map(([k, l]) => (
          <Field key={k} label={l} hint="Opcional">
            <Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </Field>
        ))}
        <Field label="Morada" hint="Opcional" className="sm:col-span-2">
          <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </Field>
        <Field label="Observações" hint="Opcional" className="sm:col-span-2">
          <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
