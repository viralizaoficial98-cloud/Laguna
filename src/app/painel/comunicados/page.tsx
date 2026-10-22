"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Download, Eye, FileText, Globe, Lock, Pencil, Pin, Plus, RotateCcw, Trash2, Undo2, UploadCloud, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type { InternalNotice, NoticeAttachment, NoticeStatus } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { useSession } from "@/hooks/use-session";
import { can } from "@/config/permissions";
import { cn, formatBytes, formatDate, formatDateTime, includesText, todayISO, uid } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { IconBtn } from "@/components/ui/icon-button";
import { DemoDataNote } from "@/components/ui/demo-badge";

const CATEGORIES = ["Geral", "Manutenção", "Assembleia", "Segurança"] as const;
const MAX_PDF = 10 * 1024 * 1024;
const schema = z.object({
  title: z.string().trim().min(5, "Título demasiado curto."),
  body: z.string().trim().min(10, "Escreva a descrição do comunicado."),
  date: z.string().min(1, "Indique a data."),
  category: z.enum(CATEGORIES),
  visibility: z.enum(["publico", "moradores"]),
  pinned: z.boolean(),
});
type FormData = z.infer<typeof schema>;

function downloadPdf(pdf: NoticeAttachment) {
  if (!pdf.dataUrl) {
    toast.info("O ficheiro deste comunicado não está disponível neste browser (demonstração).");
    return;
  }
  const a = document.createElement("a");
  a.href = pdf.dataUrl;
  a.download = pdf.name;
  a.click();
}

export default function ComunicadosPainelPage() {
  const session = useSession();
  const notices = useDemoStore((s) => s.notices);
  const saveNotice = useDemoStore((s) => s.saveNotice);
  const deleteNotice = useDemoStore((s) => s.deleteNotice);
  const canPublish = can(session?.role, "notices.publish");
  const [tab, setTab] = useState<"todos" | NoticeStatus>(canPublish ? "todos" : "publicado");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [editing, setEditing] = useState<InternalNotice | "new" | null>(null);
  const [deleting, setDeleting] = useState<InternalNotice | null>(null);
  const [viewing, setViewing] = useState<InternalNotice | null>(null);

  // perfis sem permissão de publicação só vêem comunicados publicados
  const visible = canPublish ? notices : notices.filter((n) => n.status === "publicado");
  const list = useMemo(
    () =>
      visible
        .filter((n) => (tab === "todos" || n.status === tab) && (!cat || n.category === cat) && includesText([n.title, n.body, n.pdf?.name], q))
        .sort((a, b) => Number(!!b.pinned && b.status === "publicado") - Number(!!a.pinned && a.status === "publicado") || b.date.localeCompare(a.date)),
    [visible, tab, cat, q],
  );

  const setStatus = (n: InternalNotice, status: NoticeStatus) => {
    try {
      const now = new Date().toISOString();
      saveNotice({ ...n, status, publishedAt: status === "publicado" ? now : n.publishedAt, withdrawnAt: status === "retirado" ? now : n.withdrawnAt, updatedAt: now });
      toast.success(status === "retirado" ? "Comunicado retirado de publicação" : "Comunicado publicado (demonstração)");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const count = (s: NoticeStatus) => notices.filter((n) => n.status === s).length;

  return (
    <>
      <PageHeader
        eyebrow="Comunicação"
        title="Comunicados"
        description={canPublish ? "Publicação de comunicados com documento PDF, pré-visualização, retirada de publicação e histórico." : "Comunicados publicados pela Administração do condomínio."}
        actions={
          canPublish && (
            <Button onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" /> Novo comunicado
            </Button>
          )
        }
      />
      {canPublish && (
        <Tabs
          className="mb-4"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "todos", label: "Histórico completo", count: notices.length },
            { id: "publicado", label: "Publicados", count: count("publicado") },
            { id: "rascunho", label: "Rascunhos", count: count("rascunho") },
            { id: "retirado", label: "Retirados", count: count("retirado") },
          ]}
        />
      )}
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
            <article key={n.id} className={cn("group relative flex flex-col rounded-2xl border bg-white p-6 shadow-soft transition hover:shadow-lift", n.pinned && n.status === "publicado" ? "border-gold-300" : "border-graphite-100", n.status === "retirado" && "opacity-70")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="navy">{n.category}</Badge>
                  {canPublish && <StatusBadge status={n.status} />}
                  {n.visibility === "publico" ? (
                    <Badge tone="success">
                      <Globe className="h-3 w-3" /> Público
                    </Badge>
                  ) : (
                    <Badge>
                      <Lock className="h-3 w-3" /> Moradores
                    </Badge>
                  )}
                  {n.pinned && n.status === "publicado" && (
                    <Badge tone="gold">
                      <Pin className="h-3 w-3" /> Fixado
                    </Badge>
                  )}
                </div>
                {canPublish && (
                  <div className="flex gap-1">
                    <IconBtn label="Editar" onClick={() => setEditing(n)}>
                      <Pencil className="h-4 w-4" />
                    </IconBtn>
                    {n.status === "publicado" ? (
                      <IconBtn label="Retirar de publicação" onClick={() => setStatus(n, "retirado")}>
                        <Undo2 className="h-4 w-4" />
                      </IconBtn>
                    ) : (
                      <IconBtn label={n.status === "retirado" ? "Republicar" : "Publicar"} onClick={() => setStatus(n, "publicado")}>
                        <RotateCcw className="h-4 w-4 text-emerald-700" />
                      </IconBtn>
                    )}
                    <IconBtn label="Eliminar" danger onClick={() => setDeleting(n)}>
                      <Trash2 className="h-4 w-4" />
                    </IconBtn>
                  </div>
                )}
              </div>
              <h3 className="mt-3 font-display text-2xl text-navy-900">{n.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-graphite-600">{n.body}</p>
              {n.pdf && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-graphite-100 bg-graphite-50 px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-red-600" />
                    <span className="truncate font-medium text-navy-900">{n.pdf.name}</span>
                    <span className="shrink-0 text-xs text-graphite-500">{formatBytes(n.pdf.size)}</span>
                  </span>
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setViewing(n)}>
                      <Eye className="h-3.5 w-3.5" /> Ver
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => downloadPdf(n.pdf!)}>
                      <Download className="h-3.5 w-3.5" /> Descarregar
                    </Button>
                  </span>
                </div>
              )}
              <p className="mt-4 flex items-center gap-1.5 text-xs text-graphite-400">
                <CalendarDays className="h-3.5 w-3.5" /> {formatDate(n.date)} · {n.author}
                {canPublish && n.withdrawnAt && n.status === "retirado" && ` · retirado em ${formatDate(n.withdrawnAt)}`}
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
        onSave={(d, pdf, status) => {
          const base = editing && editing !== "new" ? editing : null;
          const now = new Date().toISOString();
          try {
            saveNotice({
              ...d,
              id: base?.id ?? uid("not"),
              pdf: pdf ?? undefined,
              status,
              author: session?.name ?? "Administração",
              publishedAt: status === "publicado" ? base?.publishedAt ?? now : base?.publishedAt,
              withdrawnAt: base?.withdrawnAt,
              updatedAt: now,
            });
            toast.success(status === "publicado" ? "Comunicado publicado para os moradores (demonstração)" : "Rascunho guardado");
            setEditing(null);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
      <Modal open={!!viewing} onClose={() => setViewing(null)} size="xl" title={viewing?.title} description={viewing?.pdf?.name}>
        {viewing?.pdf?.dataUrl ? (
          <iframe src={viewing.pdf.dataUrl} title={viewing.pdf.name} className="h-[75vh] w-full rounded-xl border border-graphite-100" />
        ) : (
          <EmptyState icon={FileText} title="Pré-visualização indisponível" description="O PDF não está guardado neste browser. Na versão com servidor, o ficheiro ficará disponível para todos os moradores." />
        )}
      </Modal>
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Eliminar comunicado?"
        description={`${deleting?.title ?? ""} — prefira "Retirar de publicação" para manter o histórico.`}
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (!deleting) return;
          try {
            deleteNotice(deleting.id);
            toast.success("Comunicado eliminado.");
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    </>
  );
}

function NoticeForm({
  notice,
  open,
  onClose,
  onSave,
}: {
  notice: InternalNotice | null;
  open: boolean;
  onClose: () => void;
  onSave: (d: FormData, pdf: NoticeAttachment | null, status: NoticeStatus) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pdf, setPdf] = useState<NoticeAttachment | null>(notice?.pdf ?? null);
  const [showPreview, setShowPreview] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: notice
      ? { title: notice.title, body: notice.body, date: notice.date, category: notice.category, visibility: notice.visibility, pinned: !!notice.pinned }
      : { title: "", body: "", date: todayISO(), category: "Geral", visibility: "moradores", pinned: false },
  });

  const pick = (file: File) => {
    if (file.type !== "application/pdf") return toast.error("Seleccione um ficheiro PDF.");
    if (file.size > MAX_PDF) return toast.error("O PDF excede 10 MB.");
    const r = new FileReader();
    r.onload = () => {
      setPdf({ name: file.name, size: file.size, dataUrl: String(r.result) });
      setShowPreview(true);
    };
    r.readAsDataURL(file);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={notice ? "Editar comunicado" : "Novo comunicado"}
      description={notice?.publishedAt ? `Publicado pela primeira vez em ${formatDateTime(notice.publishedAt)}` : "Anexe o documento PDF e pré-visualize-o antes de publicar."}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={handleSubmit((d) => onSave(d, pdf, notice?.status === "publicado" ? "publicado" : "rascunho"))}>
            {notice?.status === "publicado" ? "Guardar alterações" : "Guardar rascunho"}
          </Button>
          {notice?.status !== "publicado" && <Button onClick={handleSubmit((d) => onSave(d, pdf, "publicado"))}>Publicar</Button>}
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <form className="space-y-4" noValidate onSubmit={(e) => e.preventDefault()}>
          <Field label="Título" required error={errors.title?.message}>
            <Input {...register("title")} invalid={!!errors.title} />
          </Field>
          <Field label="Descrição" required error={errors.body?.message}>
            <Textarea rows={4} {...register("body")} invalid={!!errors.body} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Data" required error={errors.date?.message}>
              <Input type="date" {...register("date")} />
            </Field>
            <Field label="Categoria">
              <Select {...register("category")}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Visibilidade">
              <Select {...register("visibility")}>
                <option value="moradores">Moradores</option>
                <option value="publico">Portal público</option>
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-graphite-700">
            <input type="checkbox" className="h-4 w-4 accent-navy-900" {...register("pinned")} /> Fixar no topo
          </label>

          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
          {pdf ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-graphite-100 bg-graphite-50 px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-red-600" />
                <span className="truncate font-medium text-navy-900">{pdf.name}</span>
                <span className="shrink-0 text-xs text-graphite-500">{formatBytes(pdf.size)}</span>
              </span>
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
                  Substituir
                </Button>
                <button onClick={() => setPdf(null)} className="rounded-lg p-1.5 text-graphite-400 hover:bg-red-50 hover:text-red-600" aria-label="Remover PDF">
                  <X className="h-4 w-4" />
                </button>
              </span>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-graphite-200 px-6 py-7 text-center transition hover:border-navy-300 hover:bg-navy-50/40">
              <UploadCloud className="h-8 w-8 text-navy-500" />
              <p className="mt-2 text-sm font-medium text-navy-900">Anexar documento PDF</p>
              <p className="text-xs text-graphite-500">Opcional · máx. 10 MB</p>
            </button>
          )}
          <DemoDataNote>O PDF fica apenas neste browser — não é enviado para servidores nesta fase.</DemoDataNote>
        </form>
        <div>
          <p className="mb-2 text-xs font-medium text-graphite-500">Pré-visualização do documento</p>
          {pdf?.dataUrl && (showPreview || notice) ? (
            <iframe src={pdf.dataUrl} title="Pré-visualização do PDF" className="h-[460px] w-full rounded-xl border border-graphite-100" />
          ) : (
            <div className="flex h-[460px] flex-col items-center justify-center rounded-xl border border-dashed border-graphite-200 bg-graphite-50 text-center text-sm text-graphite-400">
              <FileText className="mb-2 h-8 w-8" />
              {pdf ? "Pré-visualização indisponível para este ficheiro neste browser." : "Anexe um PDF para o pré-visualizar."}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
