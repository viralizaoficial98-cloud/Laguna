"use client";

import { GitMerge, Pencil } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { apiJson } from "@/lib/api-client";
import { useDemoStore } from "@/store/demo-store";
import { downloadCsv, includesText } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Toolbar } from "@/components/ui/toolbar";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IconBtn } from "@/components/ui/icon-button";
import type { PartyRow } from "./holder-modal";

/** Proprietários ou inquilinos (registos de pessoas/entidades, com ou sem conta no portal). */
export function PartiesPage({ mode }: { mode: "proprietarios" | "inquilinos" }) {
  const { data, reload } = useApi<{ parties: PartyRow[]; possibleDuplicates: { a: string; b: string; aName: string; bName: string }[] }>("/api/parties");
  const residents = useDemoStore((s) => s.residents);
  const apartments = useDemoStore((s) => s.apartments);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<PartyRow | null>(null);
  const [merge, setMerge] = useState<{ keep: string; drop: string; keepName: string; dropName: string } | null>(null);
  const rows = useMemo(
    () => (data?.parties ?? []).filter((p) => !p.archived && (mode === "proprietarios" ? p.owns.length : p.rents.length) && includesText([p.name, p.nif, p.email, p.phone, ...p.owns.map((o) => o.label), ...p.rents.map((o) => o.label)], q)),
    [data, mode, q],
  );
  const occupants = residents.filter((r) => r.status === "activo" && r.apartmentId);
  const label = (id?: string) => {
    const a = apartments.find((x) => x.id === id);
    return a ? `${a.block}-${a.number}` : "—";
  };

  return (
    <>
      <PageHeader
        eyebrow="Gestão do Condomínio"
        title={mode === "proprietarios" ? "Proprietários" : "Moradores e inquilinos"}
        description={
          mode === "proprietarios"
            ? "Titulares das fracções (pessoas ou entidades). Uma entidade pode ser proprietária de várias fracções — sem registos duplicados."
            : "Inquilinos das fracções e moradores/ocupantes registados. A residência é independente da titularidade."
        }
        actions={
          <Button
            variant="outline"
            onClick={() => downloadCsv(`laguna-${mode}.csv`, [["Nome", "NIF", "Email", "Telefone", "Fracções"], ...rows.map((p) => [p.name, p.nif ?? "", p.email ?? "", p.phone ?? "", (mode === "proprietarios" ? p.owns : p.rents).map((o) => o.label).join(" ")])])}
          >
            Exportar
          </Button>
        }
      />
      {mode === "proprietarios" && (data?.possibleDuplicates.length ?? 0) > 0 && (
        <Card className="mb-6">
          <CardHeader title="Possíveis duplicados — validar" description="Nomes semelhantes. Só são fundidos com a sua confirmação." action={<GitMerge className="h-4 w-4 text-graphite-400" />} />
          <ul className="divide-y divide-graphite-100 text-sm">
            {data!.possibleDuplicates.map((d) => (
              <li key={d.a + d.b} className="flex flex-col gap-2 px-5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {d.aName} <span className="text-graphite-400">≈</span> {d.bName}
                </span>
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setMerge({ keep: d.a, drop: d.b, keepName: d.aName, dropName: d.bName })}>
                    Manter “{d.aName.slice(0, 18)}”
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setMerge({ keep: d.b, drop: d.a, keepName: d.bName, dropName: d.aName })}>
                    Manter “{d.bName.slice(0, 18)}”
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Nome, NIF, contacto ou fracção…" className="sm:w-80" />
          <span className="text-xs text-graphite-500 sm:ml-auto">{rows.length} registos</span>
        </Toolbar>
        <DataTable
          rows={rows}
          rowKey={(p) => p.id}
          pageSize={25}
          emptyTitle={data ? "Sem registos" : "A carregar…"}
          columns={[
            { key: "n", header: "Nome", primary: true, cell: (p) => <span className="font-medium text-navy-900">{p.name}</span> },
            {
              key: "f",
              header: mode === "proprietarios" ? "Fracções (proprietário)" : "Fracções (inquilino)",
              cell: (p) => (
                <span className="flex flex-wrap gap-1">
                  {(mode === "proprietarios" ? p.owns : p.rents).map((o) => (
                    <Link key={o.holderId} href={`/painel/fraccoes?id=${o.apartmentId}`} className="rounded-md bg-navy-50 px-1.5 py-0.5 text-xs text-navy-800 hover:bg-navy-100">
                      {o.label}
                    </Link>
                  ))}
                </span>
              ),
            },
            { key: "c", header: "Contactos", hideOnMobile: true, cell: (p) => [p.phone, p.email].filter(Boolean).join(" · ") || <span className="text-graphite-400">—</span> },
            { key: "nif", header: "NIF", hideOnMobile: true, cell: (p) => p.nif ?? "—" },
            {
              key: "a",
              header: "",
              align: "right",
              cell: (p) => (
                <IconBtn label="Editar" onClick={() => setEdit(p)}>
                  <Pencil className="h-4 w-4" />
                </IconBtn>
              ),
            },
          ]}
        />
      </Card>
      {mode === "inquilinos" && (
        <Card className="mt-6">
          <CardHeader title="Moradores / ocupantes registados" description="Registo de residência (pode ter ou não conta no portal)" action={<Link href="/painel/moradores" className="text-xs font-medium text-navy-700">Cadastro de moradores</Link>} />
          <DataTable
            rows={occupants}
            rowKey={(r) => r.id}
            pageSize={15}
            columns={[
              { key: "n", header: "Nome", primary: true, cell: (r) => <span className="font-medium text-navy-900">{r.name}</span> },
              { key: "f", header: "Fracção", cell: (r) => <Link href={`/painel/fraccoes?id=${r.apartmentId}`} className="text-navy-700 underline">{label(r.apartmentId)}</Link> },
              { key: "t", header: "Tipo", cell: (r) => (r.type === "inquilino" ? "Inquilino" : "Proprietário") },
              { key: "c", header: "Contactos", hideOnMobile: true, cell: (r) => [r.phone, r.email].filter(Boolean).join(" · ") || <span className="text-graphite-400">—</span> },
            ]}
          />
        </Card>
      )}
      {edit && <EditParty party={edit} onClose={() => setEdit(null)} onSaved={reload} />}
      <ConfirmDialog
        open={!!merge}
        onClose={() => setMerge(null)}
        title="Fundir registos?"
        description={merge ? `As fracções de “${merge.dropName}” passam para “${merge.keepName}”. O registo fundido é arquivado (não é apagado) e a operação fica na auditoria.` : ""}
        confirmLabel="Fundir"
        tone="primary"
        onConfirm={async () => {
          if (!merge) return;
          try {
            const r = await apiJson<{ moved: number }>("/api/parties", { method: "POST", json: { merge: { keepId: merge.keep, mergeId: merge.drop } } });
            toast.success(`Registos fundidos (${r.moved} titularidade(s)).`);
            reload();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erro");
          }
          setMerge(null);
        }}
      />
    </>
  );
}

function EditParty({ party, onClose, onSaved }: { party: PartyRow; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: party.name, nif: party.nif ?? "", email: party.email ?? "", phone: party.phone ?? "", phone2: party.phone2 ?? "", address: party.address ?? "", notes: party.notes ?? "" });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await apiJson(`/api/parties/${party.id}`, { method: "PATCH", json: f });
      toast.success("Registo actualizado.");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Editar — ${party.name}`}
      description="Apenas o nome é obrigatório."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} loading={busy}>
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
            ["email", "Email"],
            ["phone", "Telefone"],
            ["phone2", "Telefone secundário"],
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
