"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { apiJson } from "@/lib/api-client";
import { useApi } from "@/hooks/use-api";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

export interface PartyRow {
  id: string;
  name: string;
  nif: string | null;
  email: string | null;
  phone: string | null;
  phone2: string | null;
  kind: string | null;
  address: string | null;
  notes: string | null;
  archived: boolean;
  owns: { holderId: string; apartmentId: string; label: string }[];
  rents: { holderId: string; apartmentId: string; label: string }[];
  past: { holderId: string; apartmentId: string; label: string; from: string | null; to: string | null }[];
}

/** Associar ou substituir o proprietário / inquilino de uma fracção (registo existente ou novo). */
export function HolderModal({ apartmentId, label, role, onClose, onSaved }: { apartmentId: string; label: string; role: "proprietario" | "inquilino"; onClose: () => void; onSaved: () => void }) {
  const { data } = useApi<{ parties: PartyRow[] }>("/api/parties");
  const [mode, setMode] = useState<"existente" | "novo">("existente");
  const [q, setQ] = useState("");
  const [partyId, setPartyId] = useState("");
  const [form, setForm] = useState({ name: "", nif: "", email: "", phone: "", phone2: "", notes: "" });
  const [from, setFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const options = useMemo(() => (data?.parties ?? []).filter((p) => !p.archived && p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 80), [data, q]);
  const what = role === "proprietario" ? "proprietário" : "inquilino";

  const save = async () => {
    if (mode === "existente" && !partyId) return toast.error("Seleccione o registo.");
    if (mode === "novo" && form.name.trim().length < 2) return toast.error("Indique o nome.");
    setBusy(true);
    try {
      const r = await apiJson<{ status: string }>("/api/holders", {
        method: "POST",
        json: { op: "assign", apartmentId, role, partyId: mode === "existente" ? partyId : undefined, party: mode === "novo" ? { ...form } : undefined, from: from || undefined },
      });
      toast.success(r.status === "inalterado" ? "Sem alterações (já é o titular activo)." : `${what[0].toUpperCase() + what.slice(1)} ${r.status === "substituido" ? "substituído — anterior mantido no histórico" : "associado"}.`);
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
      title={`${role === "proprietario" ? "Proprietário" : "Inquilino"} — fracção ${label}`}
      description="O titular anterior (se existir) fica no histórico de ocupação. Apenas o nome é obrigatório."
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
      <div className="mb-4 flex gap-2 text-sm">
        {(["existente", "novo"] as const).map((m) => (
          <label key={m} className="flex items-center gap-2">
            <input type="radio" checked={mode === m} onChange={() => setMode(m)} /> {m === "existente" ? "Registo existente" : "Novo registo"}
          </label>
        ))}
      </div>
      {mode === "existente" ? (
        <div className="space-y-3">
          <Input placeholder="Pesquisar nome…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={partyId} onChange={(e) => setPartyId(e.target.value)} aria-label="Registo" size={8} className="h-56">
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.owns.length ? ` · proprietário de ${p.owns.map((o) => o.label).join(", ")}` : ""}
                {p.rents.length ? ` · inquilino de ${p.rents.map((o) => o.label).join(", ")}` : ""}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" required className="sm:col-span-2">
            <Input name="partyName" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="NIF" hint="Opcional">
            <Input value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} />
          </Field>
          <Field label="Email" hint="Opcional">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Telefone" hint="Opcional">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Telefone secundário" hint="Opcional">
            <Input value={form.phone2} onChange={(e) => setForm({ ...form, phone2: e.target.value })} />
          </Field>
          <Field label="Observações" hint="Opcional" className="sm:col-span-2">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
      )}
      <Field label="Desde" hint="Opcional — data de início da titularidade/arrendamento" className="mt-4 sm:w-60">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </Field>
    </Modal>
  );
}
