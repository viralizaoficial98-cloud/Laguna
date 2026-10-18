"use client";

import { CalendarDays, Globe, Lock, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import type { InternalNotice } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { useSession } from "@/hooks/use-session";
import { DEMO_TODAY } from "@/data/management";
import { cn, formatDate, includesText, uid } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { IconBtn } from "@/components/ui/icon-button";
import { DemoDataNote } from "@/components/ui/demo-badge";

const CATEGORIES = ["Geral", "Manutenção", "Assembleia", "Segurança"] as const;
const schema = z.object({
  title: z.string().min(5, "Título demasiado curto."),
  body: z.string().min(10, "Escreva o conteúdo do comunicado."),
  category: z.enum(CATEGORIES),
  visibility: z.enum(["publico", "moradores"]),
  pinned: z.boolean(),
});
type FormData = z.infer<typeof schema>;

export default function ComunicadosPainelPage() {
  const session = useSession();
  const notices = useDemoStore((s) => s.notices);
  const saveNotice = useDemoStore((s) => s.saveNotice);
  const deleteNotice = useDemoStore((s) => s.deleteNotice);
  const canEdit = session?.role === "admin_geral" || session?.role === "administrador";
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [editing, setEditing] = useState<InternalNotice | "new" | null>(null);
  const [deleting, setDeleting] = useState<InternalNotice | null>(null);

  const list = useMemo(
    () =>
      notices
        .filter((n) => (!cat || n.category === cat) && includesText([n.title, n.body], q))
        .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.date.localeCompare(a.date)),
    [notices, cat, q],
  );

  return (
    <>
      <PageHeader
        eyebrow="Comunicação"
        title="Comunicados"
        description="Avisos da administração para moradores e para o portal público."
        actions={
          canEdit && (
            <Button onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" /> Novo comunicado
            </Button>
          )
        }
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="Pesquisar comunicados…" className="sm:w-80" />
        <div className="flex flex-wrap gap-2">
          {["", ...CATEGORIES].map((c) => (
            <button key={c || "all"} onClick={() => setCat(c)} className={cn("rounded-full px-3.5 py-1.5 text-xs font-medium transition", cat === c ? "bg-navy-900 text-white" : "bg-white text-graphite-600 ring-1 ring-graphite-200 hover:ring-navy-300")}>
              {c || "Todos"}
            </button>
          ))}
        </div>
        <DemoDataNote className="sm:ml-auto" />
      </div>

      {list.length === 0 ? (
        <div className="rounded-3xl border border-graphite-100 bg-white">
          <EmptyState title="Sem comunicados" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((n) => (
            <article key={n.id} className={cn("group relative rounded-2xl border bg-white p-6 shadow-soft transition hover:shadow-lift", n.pinned ? "border-gold-300" : "border-graphite-100")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="navy">{n.category}</Badge>
                  {n.visibility === "publico" ? (
                    <Badge tone="success"><Globe className="h-3 w-3" /> Público</Badge>
                  ) : (
                    <Badge><Lock className="h-3 w-3" /> Moradores</Badge>
                  )}
                  {n.pinned && <Badge tone="gold"><Pin className="h-3 w-3" /> Fixado</Badge>}
                </div>
                {canEdit && (
                  <div className="flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                    <IconBtn label="Editar" onClick={() => setEditing(n)}>
                      <Pencil className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn label="Eliminar" danger onClick={() => setDeleting(n)}>
                      <Trash2 className="h-4 w-4" />
                    </IconBtn>
                  </div>
                )}
              </div>
              <h3 className="mt-3 font-display text-2xl text-navy-900">{n.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-graphite-600">{n.body}</p>
              <p className="mt-4 flex items-center gap-1.5 text-xs text-graphite-400">
                <CalendarDays className="h-3.5 w-3.5" /> {formatDate(n.date)} · {n.author}
              </p>
            </article>
          ))}
        </div>
      )}

      <NoticeForm
        key={editing === "new" ? "new" : editing?.id ?? "x"}
        notice={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSave={(d) => {
          const base = editing && editing !== "new" ? editing : null;
          saveNotice({ ...d, id: base?.id ?? uid("not"), date: base?.date ?? DEMO_TODAY, author: base?.author ?? "Administração" });
          toast.success(base ? "Comunicado actualizado" : "Comunicado publicado (demonstração)");
          setEditing(null);
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Eliminar comunicado?"
        description={deleting?.title}
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deleting) deleteNotice(deleting.id);
          toast.success("Comunicado eliminado.");
        }}
      />
    </>
  );
}

function NoticeForm({ notice, open, onClose, onSave }: { notice: InternalNotice | null; open: boolean; onClose: () => void; onSave: (d: FormData) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: notice ? { title: notice.title, body: notice.body, category: notice.category, visibility: notice.visibility, pinned: !!notice.pinned } : { title: "", body: "", category: "Geral", visibility: "moradores", pinned: false },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={notice ? "Editar comunicado" : "Novo comunicado"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="notice-form">Publicar</Button>
        </>
      }
    >
      <form id="notice-form" onSubmit={handleSubmit(onSave)} className="space-y-4" noValidate>
        <Field label="Título" required error={errors.title?.message}>
          <Input {...register("title")} invalid={!!errors.title} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoria">
            <Select {...register("category")}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
          </Field>
          <Field label="Visibilidade">
            <Select {...register("visibility")}>
              <option value="moradores">Apenas moradores</option>
              <option value="publico">Portal público</option>
            </Select>
          </Field>
        </div>
        <Field label="Conteúdo" required error={errors.body?.message}>
          <Textarea rows={6} {...register("body")} invalid={!!errors.body} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-graphite-700">
          <input type="checkbox" className="h-4 w-4 accent-navy-900" {...register("pinned")} /> Fixar no topo
        </label>
      </form>
    </Modal>
  );
}
