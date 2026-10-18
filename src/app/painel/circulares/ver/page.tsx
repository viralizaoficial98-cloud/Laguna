"use client";

import { ArrowLeft, Pencil, Printer, Send } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { useDemoStore } from "@/store/demo-store";
import { useSession } from "@/hooks/use-session";
import { formatDateTime } from "@/lib/utils";
import { Button, buttonClass } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CircularDocument } from "@/components/app/widgets/circular-document";

export default function VerCircularPage() {
  const params = useSearchParams();
  const session = useSession();
  const circular = useDemoStore((s) => s.circulars.find((c) => c.id === params.get("id")));
  const saveCircular = useDemoStore((s) => s.saveCircular);
  const isStaff = session?.role === "admin_geral" || session?.role === "administrador";
  const autoPrint = params.get("print") === "1";

  useEffect(() => {
    if (autoPrint && circular) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [autoPrint, circular]);

  if (!circular || (!isStaff && circular.status !== "publicada")) {
    return (
      <div className="rounded-3xl border border-graphite-100 bg-white">
        <EmptyState title="Circular não encontrada" action={<Link href="/painel/circulares" className={buttonClass("primary")}>Voltar às circulares</Link>} />
      </div>
    );
  }

  return (
    <>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/painel/circulares" className={buttonClass("ghost", "sm")}>
            <ArrowLeft className="h-4 w-4" /> Circulares
          </Link>
          <StatusBadge status={circular.status} />
          {circular.publishedAt && <span className="text-xs text-graphite-500">Publicada em {formatDateTime(circular.publishedAt)}</span>}
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
                saveCircular({ ...circular, status: "publicada", publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
                toast.success("Circular publicada (demonstração)");
              }}
            >
              <Send className="h-3.5 w-3.5" /> Publicar
            </Button>
          )}
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Imprimir / PDF
          </Button>
        </div>
      </div>
      <div className="rounded-3xl bg-graphite-100 p-3 sm:p-8 print:bg-white print:p-0">
        <CircularDocument circular={circular} />
      </div>
    </>
  );
}
