"use client";

import { ArrowLeft, Download, FileText, Pencil, Printer, Send } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useDemoStore } from "@/store/demo-store";
import { useCurrentResident } from "@/hooks/use-session";
import { can } from "@/config/permissions";
import { formatDateTime } from "@/lib/utils";
import { circularTargets, recipientSummary } from "@/lib/circular";
import { circularPdfUrl, downloadCircularPdf } from "@/lib/circular-pdf";
import { Button, buttonClass } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { CircularDocument } from "@/components/app/widgets/circular-document";

export default function VerCircularPage() {
  const params = useSearchParams();
  const { session, apartment } = useCurrentResident();
  const circular = useDemoStore((s) => s.circulars.find((c) => c.id === params.get("id")));
  const saveCircular = useDemoStore((s) => s.saveCircular);
  const isStaff = can(session?.role, "circulars.issue");
  const viewAll = can(session?.role, "circulars.view_all");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  if (!circular || (!isStaff && (circular.status !== "publicada" || (!viewAll && !circularTargets(circular, apartment))))) {
    return (
      <div className="rounded-3xl border border-graphite-100 bg-white">
        <EmptyState
          title="Circular não encontrada"
          action={
            <Link href="/painel/circulares" className={buttonClass("primary")}>
              Voltar às circulares
            </Link>
          }
        />
      </div>
    );
  }

  const openPdf = async () => {
    const url = await circularPdfUrl(circular);
    setPdfUrl(url);
  };
  const closePdf = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
  };

  return (
    <>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/painel/circulares" className={buttonClass("ghost", "sm")}>
            <ArrowLeft className="h-4 w-4" /> Circulares
          </Link>
          <StatusBadge status={circular.status} />
          <span className="text-xs text-graphite-500">{recipientSummary(circular.recipients)}</span>
          {circular.publishedAt && <span className="text-xs text-graphite-500">· publicada em {formatDateTime(circular.publishedAt)}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {isStaff && (
            <Link href={`/painel/circulares/editor?id=${circular.id}`} className={buttonClass("outline", "sm")}>
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Link>
          )}
          {isStaff && circular.status === "rascunho" && (
            <Button
              size="sm"
              variant="subtle"
              onClick={() => {
                try {
                  saveCircular({ ...circular, status: "publicada", publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
                  toast.success("Circular publicada para os moradores");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              <Send className="h-3.5 w-3.5" /> Publicar
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={openPdf}>
            <FileText className="h-3.5 w-3.5" /> Ver PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </Button>
          <Button size="sm" onClick={() => void downloadCircularPdf(circular)}>
            <Download className="h-3.5 w-3.5" /> Descarregar PDF
          </Button>
        </div>
      </div>
      <div className="rounded-3xl bg-graphite-100 p-3 sm:p-8 print:bg-white print:p-0">
        <CircularDocument circular={circular} />
      </div>
      <Modal open={!!pdfUrl} onClose={closePdf} size="xl" title={`Circular N.º ${circular.number}`} description="PDF A4 gerado no browser">
        {pdfUrl && <iframe src={pdfUrl} title={`Circular ${circular.number}`} className="h-[75vh] w-full rounded-xl border border-graphite-100" />}
      </Modal>
    </>
  );
}
