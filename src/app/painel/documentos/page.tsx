"use client";

import { Download, Eye, FileSpreadsheet, FileText, FileType, Image as ImageIcon, Trash2, UploadCloud } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { CondoDocument, DocumentCategory } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { useSession } from "@/hooks/use-session";
import { can } from "@/config/permissions";
import { cn, downloadBlob, formatBytes, formatDate, includesText, uid } from "@/lib/utils";
import { DEMO_TODAY } from "@/data/management";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Toolbar } from "@/components/ui/toolbar";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { IconBtn } from "@/components/ui/icon-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DemoDataNote } from "@/components/ui/demo-badge";

const CATS: { id: DocumentCategory; label: string }[] = [
  { id: "circular", label: "Circulares" },
  { id: "regulamento", label: "Regulamentos" },
  { id: "acta", label: "Actas" },
  { id: "comunicado", label: "Comunicados" },
  { id: "institucional", label: "Institucionais" },
];
const VIS_LABEL = { publico: "Público", moradores: "Moradores", administracao: "Administração" } as const;

function FileIcon({ type, className }: { type: CondoDocument["fileType"]; className?: string }) {
  const I = type === "XLSX" ? FileSpreadsheet : type === "DOCX" ? FileType : type === "IMG" ? ImageIcon : FileText;
  return <I className={className} />;
}

export default function DocumentosPage() {
  const session = useSession();
  const documents = useDemoStore((s) => s.documents);
  const addDocument = useDemoStore((s) => s.addDocument);
  const deleteDocument = useDemoStore((s) => s.deleteDocument);
  const canManage = can(session?.role, "documents.manage");
  const seeAdmin = canManage;

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<DocumentCategory | "">("");
  const [preview, setPreview] = useState<CondoDocument | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<CondoDocument | null>(null);

  const visible = documents.filter((d) => seeAdmin || d.visibility !== "administracao");
  const rows = useMemo(() => visible.filter((d) => (!cat || d.category === cat) && includesText([d.title, d.description], q)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [visible, cat, q]);

  const download = (d: CondoDocument) => {
    const content = `RESIDENCIAL LAGUNA — DOCUMENTO DE DEMONSTRAÇÃO\n\nTítulo: ${d.title}\nCategoria: ${d.category}\nActualizado: ${formatDate(d.updatedAt)}\n\n${d.description}\n\nEste ficheiro foi gerado localmente para demonstrar a funcionalidade de download.\nO documento original será disponibilizado na fase de integração com o servidor.`;
    downloadBlob(`${d.title.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}-demo.txt`, new Blob([content], { type: "text/plain;charset=utf-8" }));
    toast.success("Download de demonstração iniciado.");
  };

  return (
    <>
      <PageHeader
        eyebrow="Gestão documental"
        title="Documentos"
        description="Circulares, regulamentos, actas, comunicados e documentos institucionais."
        actions={
          canManage && (
            <Button onClick={() => setUploading(true)}>
              <UploadCloud className="h-4 w-4" /> Carregar documento
            </Button>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {CATS.map((c) => {
          const n = visible.filter((d) => d.category === c.id).length;
          return (
            <button key={c.id} onClick={() => setCat(cat === c.id ? "" : c.id)} className={cn("rounded-2xl border bg-white p-4 text-left shadow-soft transition hover:-translate-y-0.5", cat === c.id ? "border-navy-900 ring-2 ring-navy-100" : "border-graphite-100")}>
              <p className="text-xs text-graphite-500">{c.label}</p>
              <p className="mt-1 text-2xl font-semibold text-navy-900">{n}</p>
            </button>
          );
        })}
      </div>

      <Card>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Pesquisar documentos…" className="sm:w-80" />
          <Select value={cat} onChange={(e) => setCat(e.target.value as DocumentCategory | "")} className="sm:w-48" aria-label="Categoria">
            <option value="">Todas as categorias</option>
            {CATS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
          <DemoDataNote className="sm:ml-auto" />
        </Toolbar>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={setPreview}
          columns={[
            {
              key: "title",
              header: "Documento",
              primary: true,
              cell: (d) => (
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
                    <FileIcon type={d.fileType} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-navy-900">{d.title}</span>
                    <span className="block truncate text-xs text-graphite-500">{d.description}</span>
                  </span>
                </span>
              ),
            },
            { key: "cat", header: "Categoria", cell: (d) => <Badge tone="navy">{CATS.find((c) => c.id === d.category)?.label}</Badge> },
            { key: "vis", header: "Visibilidade", cell: (d) => <Badge tone={d.visibility === "administracao" ? "warning" : d.visibility === "publico" ? "success" : "neutral"}>{VIS_LABEL[d.visibility]}</Badge>, hideOnMobile: true },
            { key: "size", header: "Tamanho", cell: (d) => `${d.fileType} · ${formatBytes(d.size)}`, hideOnMobile: true },
            { key: "date", header: "Actualizado", cell: (d) => formatDate(d.updatedAt) },
            {
              key: "actions",
              header: "",
              align: "right",
              cell: (d) => (
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <IconBtn label="Pré-visualizar" onClick={() => setPreview(d)}>
                    <Eye className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn label="Descarregar" onClick={() => download(d)}>
                    <Download className="h-4 w-4" />
                  </IconBtn>
                  {canManage && (
                    <IconBtn label="Eliminar" danger onClick={() => setDeleting(d)}>
                      <Trash2 className="h-4 w-4" />
                    </IconBtn>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={!!preview} onClose={() => setPreview(null)} size="lg" title={preview?.title} description={preview ? `${CATS.find((c) => c.id === preview.category)?.label} · ${preview.fileType} · ${formatBytes(preview.size)}` : ""} footer={preview && <Button onClick={() => download(preview)}><Download className="h-4 w-4" /> Descarregar</Button>}>
        {preview && (
          <div className="rounded-2xl bg-graphite-100 p-4 sm:p-8">
            <div className="mx-auto max-w-lg bg-white p-8 shadow-soft">
              <div className="flex items-center justify-between border-b border-graphite-200 pb-4">
                <FileIcon type={preview.fileType} className="h-8 w-8 text-navy-700" />
                <span className="text-[10px] tracking-[0.2em] text-graphite-400 uppercase">Pré-visualização</span>
              </div>
              <p className="mt-6 font-display text-2xl text-navy-900">{preview.title}</p>
              <p className="mt-3 text-sm text-graphite-600">{preview.description}</p>
              <div className="mt-6 space-y-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-2 rounded bg-graphite-100" style={{ width: `${95 - ((i * 13) % 35)}%` }} />
                ))}
              </div>
              <p className="mt-6 text-[11px] text-graphite-400">Carregado por {preview.uploadedBy} · {formatDate(preview.updatedAt)}. O conteúdo integral estará disponível após integração com o servidor.</p>
            </div>
          </div>
        )}
      </Modal>

      <UploadModal
        open={uploading}
        onClose={() => setUploading(false)}
        onUpload={(d) => {
          addDocument({ ...d, id: uid("doc"), updatedAt: DEMO_TODAY, uploadedBy: session?.name ?? "Administração" });
          toast.success("Documento adicionado (apenas localmente).");
          setUploading(false);
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Eliminar documento?"
        description={deleting?.title}
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deleting) deleteDocument(deleting.id);
          toast.success("Documento eliminado (demo).");
        }}
      />
    </>
  );
}

function UploadModal({ open, onClose, onUpload }: { open: boolean; onClose: () => void; onUpload: (d: Omit<CondoDocument, "id" | "updatedAt" | "uploadedBy">) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("comunicado");
  const [visibility, setVisibility] = useState<CondoDocument["visibility"]>("moradores");

  const submit = () => {
    if (!file || title.trim().length < 3) {
      toast.error("Seleccione um ficheiro e indique o título.");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    onUpload({
      title: title.trim(),
      description: description.trim() || file.name,
      category,
      visibility,
      size: file.size,
      fileType: ext === "xlsx" || ext === "xls" ? "XLSX" : ext === "docx" || ext === "doc" ? "DOCX" : file.type.startsWith("image/") ? "IMG" : "PDF",
    });
    setFile(null);
    setTitle("");
    setDescription("");
  };

  return (
    <Modal open={open} onClose={onClose} title="Carregar documento" description="Upload demonstrativo — o ficheiro não sai do seu dispositivo." footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={submit}>Adicionar</Button></>}>
      <input ref={ref} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); if (!title) setTitle(f.name.replace(/\.[^.]+$/, "")); } }} />
      <button type="button" onClick={() => ref.current?.click()} className="flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-graphite-200 px-6 py-8 text-center transition hover:border-navy-300 hover:bg-navy-50/40">
        <UploadCloud className="h-8 w-8 text-navy-500" />
        <p className="mt-2 text-sm font-medium text-navy-900">{file ? file.name : "Seleccionar ficheiro"}</p>
        <p className="text-xs text-graphite-500">{file ? formatBytes(file.size) : "PDF, DOCX, XLSX ou imagem"}</p>
      </button>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Título" required className="sm:col-span-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Categoria">
          <Select value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
            {CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
        </Field>
        <Field label="Visibilidade">
          <Select value={visibility} onChange={(e) => setVisibility(e.target.value as CondoDocument["visibility"])}>
            <option value="moradores">Moradores</option>
            <option value="publico">Público</option>
            <option value="administracao">Administração</option>
          </Select>
        </Field>
        <Field label="Descrição" className="sm:col-span-2">
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
