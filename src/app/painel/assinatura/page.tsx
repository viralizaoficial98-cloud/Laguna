"use client";

import { PenLine, ShieldAlert, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { useSession } from "@/hooks/use-session";
import { apiJson } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

interface SigResp {
  active: { id: string; fileId: string; displayName: string; title: string; createdAt: string } | null;
  history: { id: string; displayName: string; title: string; active: boolean; createdAt: string; revokedAt: string | null }[];
  signed: { id: string; number: string; typeCode: string; subjectName: string; status: string; signedAt: string | null }[];
  provider: string;
}

/** Configurações → Minha Assinatura: imagem PNG privada, nome e cargo, histórico de documentos assinados. */
export default function AssinaturaPage() {
  const session = useSession();
  const { data, reload } = useApi<SigResp>("/api/signature");
  const ref = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [revoke, setRevoke] = useState(false);
  const displayName = name || data?.active?.displayName || session?.name || "";
  const displayTitle = title || data?.active?.title || (session?.role === "gestor" ? "O Gestor Operacional" : "O Administrador");

  const upload = async () => {
    if (!file) return toast.error("Seleccione a imagem PNG.");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("displayName", displayName);
      form.append("title", displayTitle);
      const res = await fetch("/api/signature", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Assinatura guardada.", { description: json.transparent ? undefined : "Atenção: a imagem não tem fundo transparente." });
      setFile(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Administração" title="Minha assinatura" description="Imagem da sua assinatura (PNG transparente), guardada de forma privada: só a vê e utiliza o próprio. Nunca é aplicada sem a sua confirmação em cada documento." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Assinatura activa" action={<PenLine className="h-4 w-4 text-graphite-400" />} />
          <CardBody className="space-y-4">
            {data?.active ? (
              <div className="rounded-2xl border border-dashed border-graphite-200 bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] p-6 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/files/${data.active.fileId}`} alt="Assinatura" className="mx-auto max-h-28" />
                <p className="mt-3 text-sm text-graphite-600">{data.active.title}</p>
                <p className="font-semibold text-navy-900">{data.active.displayName}</p>
                <p className="text-xs text-graphite-400">carregada em {formatDateTime(data.active.createdAt)}</p>
              </div>
            ) : (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Ainda não carregou a sua assinatura — é necessária para assinar declarações.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome apresentado">
                <Input value={displayName} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Cargo apresentado">
                <Input value={displayTitle} onChange={(e) => setTitle(e.target.value)} />
              </Field>
            </div>
            <input ref={ref} type="file" accept="image/png" className="hidden" data-testid="signature-file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => ref.current?.click()}>
                <Upload className="h-4 w-4" /> {file ? file.name : data?.active ? "Substituir imagem (PNG)" : "Carregar imagem (PNG)"}
              </Button>
              <Button onClick={() => void upload()} loading={busy} disabled={!file}>
                Guardar
              </Button>
              {data?.active && !file && (
                <Button
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await apiJson("/api/signature", { method: "PATCH", json: { displayName, title: displayTitle } });
                      toast.success("Nome e cargo actualizados.");
                      reload();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Erro");
                    }
                  }}
                >
                  Guardar nome e cargo
                </Button>
              )}
              {data?.active && (
                <Button variant="ghost" className="text-red-600" onClick={() => setRevoke(true)}>
                  Revogar
                </Button>
              )}
            </div>
            <p className="flex items-start gap-2 rounded-xl bg-graphite-50 p-3 text-xs text-graphite-600">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              A imagem de assinatura não é uma assinatura digital qualificada. O sistema regista o utilizador autenticado, a data, a hora e o documento, e inclui um código QR de verificação. A arquitectura está preparada para integrar um prestador de assinatura electrónica qualificada (fornecedor actual: {data?.provider ?? "imagem"}).
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Documentos assinados" description="Para anular um documento, abra-o em Documentos assinados." action={<Link href="/painel/declaracoes/assinados" className="text-xs font-medium text-navy-700">Abrir</Link>} />
          <DataTable
            rows={data?.signed ?? []}
            rowKey={(d) => d.id}
            emptyTitle="Sem documentos assinados"
            columns={[
              { key: "n", header: "N.º", primary: true, cell: (d) => <span className="font-semibold text-navy-900">{d.number}</span> },
              { key: "s", header: "Titular", cell: (d) => d.subjectName },
              { key: "d", header: "Assinado", cell: (d) => (d.signedAt ? formatDateTime(d.signedAt) : "—") },
              { key: "st", header: "Estado", cell: (d) => <StatusBadge status={`decl_${d.status}`} /> },
            ]}
          />
        </Card>
      </div>
      <ConfirmDialog
        open={revoke}
        onClose={() => setRevoke(false)}
        title="Revogar assinatura?"
        description="Deixa de ser possível assinar documentos até carregar uma nova imagem. Os documentos já emitidos não são alterados."
        confirmLabel="Revogar"
        onConfirm={async () => {
          try {
            await apiJson("/api/signature", { method: "DELETE" });
            toast.success("Assinatura revogada.");
            reload();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erro");
          }
          setRevoke(false);
        }}
      />
    </>
  );
}
