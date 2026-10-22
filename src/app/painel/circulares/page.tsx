"use client";

import { Eye, Pencil, Plus, Download, Send, Archive, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Circular, CircularStatus } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { useCurrentResident } from "@/hooks/use-session";
import { can } from "@/config/permissions";
import { circularTargets, recipientSummary } from "@/lib/circular";
import { downloadCircularPdf } from "@/lib/circular-pdf";
import { formatDate, includesText } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Field, Input } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { Toolbar } from "@/components/ui/toolbar";
import { Tabs } from "@/components/ui/tabs";
import { IconBtn } from "@/components/ui/icon-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function CircularesPage() {
  const router = useRouter();
  const { session, apartment } = useCurrentResident();
  const circulars = useDemoStore((s) => s.circulars);
  const saveCircular = useDemoStore((s) => s.saveCircular);
  const deleteCircular = useDemoStore((s) => s.deleteCircular);
  const isStaff = can(session?.role, "circulars.issue");
  const viewAll = can(session?.role, "circulars.view_all");

  const [tab, setTab] = useState<"todas" | CircularStatus>(isStaff ? "todas" : "publicada");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [deleting, setDeleting] = useState<Circular | null>(null);

  // o morador vê apenas as circulares publicadas destinadas à sua fracção
  const visible = isStaff ? circulars : circulars.filter((c) => c.status === "publicada" && (viewAll || circularTargets(c, apartment)));
  const rows = useMemo(
    () =>
      visible
        .filter((c) => (tab === "todas" || c.status === tab) && (!from || c.date >= from) && (!to || c.date <= to))
        .filter((c) => includesText([c.subject, c.number, c.body], q))
        .sort((a, b) => b.year - a.year || b.sequence - a.sequence),
    [visible, tab, from, to, q],
  );

  const setStatus = (c: Circular, status: CircularStatus) => {
    saveCircular({ ...c, status, publishedAt: status === "publicada" ? new Date().toISOString() : c.publishedAt, updatedAt: new Date().toISOString() });
    toast.success(status === "publicada" ? `Circular ${c.number} publicada (demo)` : `Circular ${c.number} arquivada`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Comunicação"
        title="Circulares"
        description={isStaff ? "Emissão de circulares no modelo oficial (N.º/ADMLR/ano), pré-visualização, PDF A4, publicação e histórico." : viewAll ? "Circulares publicadas pela Administração (consulta)." : "Circulares publicadas pela Administração para a sua fracção."}
        actions={
          isStaff && (
            <Link href="/painel/circulares/editor" className={buttonClass("primary")}>
              <Plus className="h-4 w-4" /> Emitir circular
            </Link>
          )
        }
      />
      <Card>
        {isStaff && (
          <Toolbar>
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "todas", label: "Todas", count: circulars.length },
                { id: "publicada", label: "Publicadas", count: circulars.filter((c) => c.status === "publicada").length },
                { id: "rascunho", label: "Rascunhos", count: circulars.filter((c) => c.status === "rascunho").length },
                { id: "arquivada", label: "Histórico / arquivadas", count: circulars.filter((c) => c.status === "arquivada").length },
              ]}
            />
          </Toolbar>
        )}
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Pesquisar por assunto ou número…" className="sm:w-72" />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Field className="sm:w-40">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Data inicial" />
            </Field>
            <Field className="sm:w-40">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Data final" />
            </Field>
          </div>
        </Toolbar>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(c) => router.push(`/painel/circulares/ver?id=${c.id}`)}
          columns={[
            { key: "number", header: "N.º", cell: (c) => <span className="font-mono text-xs font-semibold text-navy-900">{c.number}</span> },
            { key: "subject", header: "Assunto", primary: true, cell: (c) => <span className="font-medium text-navy-900">{c.subject}</span> },
            { key: "date", header: "Data", cell: (c) => formatDate(c.date) },
            { key: "audience", header: "Destinatários", cell: (c) => recipientSummary(c.recipients), hideOnMobile: true },
            { key: "author", header: "Responsável", cell: (c) => c.author, hideOnMobile: true },
            { key: "status", header: "Estado", cell: (c) => <StatusBadge status={c.status} /> },
            {
              key: "actions",
              header: "",
              align: "right",
              cell: (c) => (
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <IconBtn label="Pré-visualizar" onClick={() => router.push(`/painel/circulares/ver?id=${c.id}`)}>
                    <Eye className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn label="Descarregar PDF" onClick={() => void downloadCircularPdf(c)}>
                    <Download className="h-4 w-4" />
                  </IconBtn>
                  {isStaff && (
                    <>
                      <IconBtn label="Editar" onClick={() => router.push(`/painel/circulares/editor?id=${c.id}`)}>
                        <Pencil className="h-4 w-4" />
                      </IconBtn>
                      {c.status === "rascunho" && (
                        <IconBtn label="Publicar" onClick={() => setStatus(c, "publicada")}>
                          <Send className="h-4 w-4 text-emerald-700" />
                        </IconBtn>
                      )}
                      {c.status === "publicada" && (
                        <IconBtn label="Arquivar" onClick={() => setStatus(c, "arquivada")}>
                          <Archive className="h-4 w-4" />
                        </IconBtn>
                      )}
                      <IconBtn label="Eliminar" danger onClick={() => setDeleting(c)}>
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
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Eliminar circular ${deleting?.number}?`}
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (deleting) deleteCircular(deleting.id);
          toast.success("Circular eliminada (demo).");
        }}
      />
    </>
  );
}
