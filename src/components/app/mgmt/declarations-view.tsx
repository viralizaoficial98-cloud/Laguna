"use client";

import { CheckCircle2, Download, FilePlus2, FileSignature, PenLine, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { useSession } from "@/hooks/use-session";
import { useDemoStore } from "@/store/demo-store";
import { apiJson } from "@/lib/api-client";
import { BLOCKS } from "@/data/management";
import { formatDateTime, includesText } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { SearchInput } from "@/components/ui/search-input";
import { Toolbar } from "@/components/ui/toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";

export interface Decl {
  id: string;
  number: string;
  typeCode: string;
  typeName: string;
  apartmentId: string;
  subjectName: string;
  purpose: string | null;
  status: "solicitada" | "em_analise" | "aguardando_assinatura" | "emitida" | "rejeitada" | "cancelada" | "anulada";
  channel: string;
  requestedByName: string;
  requestedAt: string;
  content: string | null;
  checks: { at: string; ownershipConfirmed: boolean; items: { label: string; ok: boolean; detail: string }[] } | null;
  rejectionReason: string | null;
  signerName: string | null;
  signerTitle: string | null;
  signedAt: string | null;
  pdfFileId: string | null;
  verificationCode: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  history: { at: string; by: string; text: string }[];
}
interface DType {
  code: string;
  name: string;
  requirement: string;
  active: boolean;
  residentCanRequest: boolean;
}
const REQ: Record<string, string> = {
  nenhum: "Sem requisito automático",
  residencia: "Exige morador ou inquilino registado",
  titularidade: "Exige proprietário registado e documentação verificada",
  sem_divida: "Exige ausência de dívidas e de pagamentos por validar",
  situacao_financeira: "Indica os valores da conta corrente",
};

export type DeclMode = "solicitacoes" | "emitir" | "pendentes" | "assinados";

export function DeclarationsView({ mode }: { mode: DeclMode }) {
  const session = useSession();
  return session?.role === "morador" ? <ResidentDeclarations /> : <StaffDeclarations mode={mode} />;
}

function ResidentDeclarations() {
  const { data, reload } = useApi<{ declarations: Decl[]; types: DType[] }>("/api/declarations");
  const [typeCode, setTypeCode] = useState("");
  const [purpose, setPurpose] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!typeCode) return toast.error("Escolha o tipo de declaração.");
    setBusy(true);
    try {
      await apiJson("/api/declarations", { method: "POST", json: { typeCode, purpose } });
      toast.success("Pedido enviado à Administração Laguna.", { description: "Será notificado quando a declaração estiver disponível." });
      setTypeCode("");
      setPurpose("");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };
  const cancel = async (d: Decl) => {
    try {
      await apiJson(`/api/declarations/${d.id}`, { method: "POST", json: { op: "cancel" } });
      toast.success("Pedido cancelado.");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };
  return (
    <>
      <PageHeader eyebrow="Documentos" title="Solicitar Declaração" description="Peça documentos oficiais à Administração Laguna. A declaração é preparada com os dados verificados no sistema, assinada e fica disponível aqui." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader title="Novo pedido" />
          <CardBody className="space-y-3" data-testid="declaration-request">
            <Field label="Tipo de declaração" required>
              <Select value={typeCode} onChange={(e) => setTypeCode(e.target.value)} aria-label="Tipo de declaração">
                <option value="">Seleccione…</option>
                {(data?.types ?? []).map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Finalidade" hint="Opcional — ex.: processo bancário, escola, embaixada">
              <Textarea rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            </Field>
            <Button onClick={() => void submit()} loading={busy} disabled={busy}>
              <FileSignature className="h-4 w-4" /> Submeter pedido
            </Button>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Os meus pedidos" />
          {!(data?.declarations ?? []).length ? (
            <EmptyState icon={FileSignature} title="Sem pedidos" description="Os pedidos e as declarações emitidas aparecem aqui." />
          ) : (
            <ul className="divide-y divide-graphite-100 text-sm">
              {data!.declarations.map((d) => (
                <li key={d.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    <strong className="text-navy-900">{d.typeName}</strong>
                    <span className="block text-xs text-graphite-500">
                      {d.number} · pedido em {formatDateTime(d.requestedAt)}
                      {d.purpose ? ` · ${d.purpose}` : ""}
                    </span>
                    {d.rejectionReason && <span className="block text-xs text-red-600">Rejeitada: {d.rejectionReason}</span>}
                    {d.revokeReason && <span className="block text-xs text-amber-700">Anulada: {d.revokeReason}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={`decl_${d.status}`} />
                    {d.status === "emitida" && d.pdfFileId && (
                      <a href={`/api/files/${d.pdfFileId}`} target="_blank" rel="noreferrer" className={buttonClass("outline", "sm")}>
                        <Download className="h-3.5 w-3.5" /> Descarregar
                      </a>
                    )}
                    {(d.status === "solicitada" || d.status === "em_analise") && (
                      <Button size="sm" variant="ghost" onClick={() => void cancel(d)}>
                        Cancelar
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function StaffDeclarations({ mode }: { mode: DeclMode }) {
  const { data, reload } = useApi<{ declarations: Decl[]; types: DType[] }>("/api/declarations");
  const apartments = useDemoStore((s) => s.apartments);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const all = data?.declarations ?? [];
  const filter: Record<DeclMode, Decl["status"][]> = {
    solicitacoes: ["solicitada", "em_analise", "rejeitada", "cancelada"],
    emitir: [],
    pendentes: ["aguardando_assinatura"],
    assinados: ["emitida", "anulada"],
  };
  const rows = all.filter((d) => filter[mode].includes(d.status) && includesText([d.number, d.subjectName, d.typeName, apt(d.apartmentId)], q));
  function apt(id: string) {
    const a = apartments.find((x) => x.id === id);
    return a ? `${a.block}-${a.number}` : id;
  }
  const titles: Record<DeclMode, [string, string]> = {
    solicitacoes: ["Solicitações de declarações", "Pedidos dos moradores e pedidos presenciais. Analise, prepare e envie para assinatura."],
    emitir: ["Emitir declaração", "Pedido presencial: a declaração é preparada com os dados verificados da fracção."],
    pendentes: ["Documentos pendentes", "Declarações revistas a aguardar assinatura."],
    assinados: ["Documentos assinados", "Declarações emitidas (com verificação por QR) e documentos anulados."],
  };
  const selected = all.find((d) => d.id === open) ?? null;
  return (
    <>
      <PageHeader eyebrow="Documentos" title={titles[mode][0]} description={titles[mode][1]} />
      {mode !== "emitir" && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard index={0} label="Solicitadas" value={all.filter((d) => d.status === "solicitada").length} icon={FileSignature} tone="navy" />
          <StatCard index={1} label="Em análise" value={all.filter((d) => d.status === "em_analise").length} icon={FileSignature} tone="info" />
          <StatCard index={2} highlight label="A aguardar assinatura" value={all.filter((d) => d.status === "aguardando_assinatura").length} icon={PenLine} />
          <StatCard index={3} label="Emitidas" value={all.filter((d) => d.status === "emitida").length} icon={CheckCircle2} tone="success" />
        </div>
      )}
      {mode === "emitir" ? (
        <IssueForm types={data?.types ?? []} onCreated={(id) => (reload(), setOpen(id))} />
      ) : (
        <Card>
          <Toolbar>
            <SearchInput value={q} onChange={setQ} placeholder="Número, nome, fracção ou tipo…" className="sm:w-80" />
            <Link href="/painel/declaracoes/emitir" className={buttonClass("outline", "sm", "sm:ml-auto")}>
              <FilePlus2 className="h-4 w-4" /> Emitir declaração
            </Link>
          </Toolbar>
          <DataTable
            rows={rows}
            rowKey={(d) => d.id}
            onRowClick={(d) => setOpen(d.id)}
            emptyTitle={data ? "Sem documentos" : "A carregar…"}
            columns={[
              { key: "n", header: "N.º", primary: true, cell: (d) => <span className="font-semibold text-navy-900">{d.number}</span> },
              { key: "t", header: "Tipo", cell: (d) => d.typeName },
              { key: "s", header: "Titular", cell: (d) => d.subjectName },
              { key: "f", header: "Fracção", cell: (d) => apt(d.apartmentId) },
              { key: "c", header: "Origem", hideOnMobile: true, cell: (d) => (d.channel === "portal" ? "Portal" : "Presencial") },
              { key: "d", header: "Pedido", hideOnMobile: true, cell: (d) => formatDateTime(d.requestedAt) },
              { key: "st", header: "Estado", cell: (d) => <StatusBadge status={`decl_${d.status}`} /> },
            ]}
          />
        </Card>
      )}
      {selected && <DeclarationDetail decl={selected} apt={apt(selected.apartmentId)} requirement={data?.types.find((t) => t.code === selected.typeCode)?.requirement ?? "nenhum"} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}

function IssueForm({ types, onCreated }: { types: DType[]; onCreated: (id: string) => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const apartments = useDemoStore((s) => s.apartments);
  const initial = apartments.find((a) => a.id === params.get("apt"));
  const [block, setBlock] = useState(initial?.block ?? "01");
  const [aptId, setAptId] = useState(initial?.id ?? "");
  const [typeCode, setTypeCode] = useState("");
  const [subject, setSubject] = useState<"morador" | "proprietario" | "inquilino">("morador");
  const [purpose, setPurpose] = useState("");
  const [busy, setBusy] = useState(false);
  const type = types.find((t) => t.code === typeCode);
  useEffect(() => {
    // a titularidade refere-se ao proprietário
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (type?.requirement === "titularidade") setSubject("proprietario");
  }, [type]);
  const submit = async () => {
    if (!typeCode || !aptId) return toast.error("Seleccione o tipo e a fracção.");
    setBusy(true);
    try {
      const r = await apiJson<{ declaration: Decl }>("/api/declarations", { method: "POST", json: { typeCode, apartmentId: aptId, subject, purpose } });
      toast.success(`Declaração ${r.declaration.number} criada — reveja e envie para assinatura.`);
      onCreated(r.declaration.id);
      router.replace("/painel/declaracoes/emitir");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="max-w-3xl">
      <CardBody className="grid gap-4 sm:grid-cols-2" data-testid="declaration-issue">
        <Field label="Tipo de declaração" required className="sm:col-span-2" hint={type ? REQ[type.requirement] : undefined}>
          <Select value={typeCode} onChange={(e) => setTypeCode(e.target.value)} aria-label="Tipo de declaração">
            <option value="">Seleccione…</option>
            {types.filter((t) => t.active).map((t) => (
              <option key={t.code} value={t.code}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Bloco">
          <Select value={block} onChange={(e) => (setBlock(e.target.value), setAptId(""))} aria-label="Bloco">
            {BLOCKS.map((b) => (
              <option key={b} value={b}>
                Bloco {b}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fracção" required>
          <Select value={aptId} onChange={(e) => setAptId(e.target.value)} aria-label="Fracção">
            <option value="">Seleccione…</option>
            {apartments
              .filter((a) => a.block === block && a.active)
              .sort((a, b) => a.number.localeCompare(b.number))
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.block}-{a.number} · {a.typology}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Declaração em nome de" required>
          <Select value={subject} onChange={(e) => setSubject(e.target.value as typeof subject)} aria-label="Titular">
            <option value="morador">Morador registado</option>
            <option value="proprietario">Proprietário</option>
            <option value="inquilino">Inquilino</option>
          </Select>
        </Field>
        <Field label="Finalidade" hint="Opcional">
          <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Button onClick={() => void submit()} loading={busy} disabled={busy}>
            <FilePlus2 className="h-4 w-4" /> Criar e rever
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function DeclarationDetail({ decl, apt, requirement, onClose, onChanged }: { decl: Decl; apt: string; requirement: string; onClose: () => void; onChanged: () => void }) {
  const [ownership, setOwnership] = useState(decl.checks?.ownershipConfirmed ?? false);
  const { data: preview } = useApi<{ checks: { label: string; ok: boolean; detail: string }[]; ok: boolean; suggested: string }>(["em_analise", "aguardando_assinatura", "solicitada"].includes(decl.status) ? `/api/declarations/${decl.id}?titularidade=${ownership ? 1 : 0}` : null);
  const [content, setContent] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [confirmSign, setConfirmSign] = useState(false);
  const [busy, setBusy] = useState(false);
  const text = content ?? decl.content ?? preview?.suggested ?? "";
  const checks = useMemo(() => preview?.checks ?? decl.checks?.items ?? [], [preview, decl]);

  const op = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try {
      await apiJson(`/api/declarations/${decl.id}`, { method: "POST", json: body });
      toast.success(ok);
      onChanged();
      if (body.op !== "review" && body.op !== "prepare") onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro", { duration: 8000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="xl" title={`${decl.number} · ${decl.typeName}`} description={`${decl.subjectName} · fracção ${apt}${decl.purpose ? ` · finalidade: ${decl.purpose}` : ""}`}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={`decl_${decl.status}`} />
            <span className="text-xs text-graphite-500">
              {decl.channel === "portal" ? "Pedido pelo portal" : "Pedido presencial"} · {decl.requestedByName} · {formatDateTime(decl.requestedAt)}
            </span>
          </div>
          {checks.length > 0 && (
            <div className="rounded-xl border border-graphite-100 p-3 text-sm" data-testid="declaration-checks">
              <p className="mb-2 text-xs font-semibold tracking-wider text-graphite-500 uppercase">Verificação com dados do sistema</p>
              {checks.map((c) => (
                <p key={c.label} className={c.ok ? "text-emerald-800" : "text-red-700"}>
                  {c.ok ? <CheckCircle2 className="mr-1 inline h-4 w-4" /> : <XCircle className="mr-1 inline h-4 w-4" />}
                  {c.label} — <span className="text-xs">{c.detail}</span>
                </p>
              ))}
            </div>
          )}
          {requirement === "titularidade" && ["em_analise", "solicitada", "aguardando_assinatura"].includes(decl.status) && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={ownership} onChange={(e) => setOwnership(e.target.checked)} className="mt-1" name="ownership" />
              Confirmo que a documentação de titularidade (ex.: certidão predial, escritura) foi apresentada e verificada.
            </label>
          )}
          {["em_analise", "aguardando_assinatura"].includes(decl.status) ? (
            <Field label="Texto da declaração" hint="Revisto pela gestão. Os dados da fracção e do titular são impressos a partir do sistema.">
              <Textarea rows={9} value={text} onChange={(e) => setContent(e.target.value)} name="content" />
            </Field>
          ) : (
            decl.content && <p className="rounded-xl bg-graphite-50 p-3 text-sm whitespace-pre-line">{decl.content}</p>
          )}
          {decl.status === "emitida" && (
            <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
              Assinada por {decl.signerName} ({decl.signerTitle}) em {decl.signedAt ? formatDateTime(decl.signedAt) : ""} · código de verificação <strong>{decl.verificationCode}</strong>
            </p>
          )}
          {decl.revokeReason && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Anulada: {decl.revokeReason}</p>}
          {decl.rejectionReason && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Rejeitada: {decl.rejectionReason}</p>}
          <div className="flex flex-wrap gap-2">
            {decl.status === "solicitada" && (
              <Button onClick={() => void op({ op: "review" }, "Pedido em análise.")} loading={busy}>
                Iniciar análise
              </Button>
            )}
            {["em_analise", "aguardando_assinatura"].includes(decl.status) && (
              <Button variant={decl.status === "aguardando_assinatura" ? "outline" : "primary"} onClick={() => void op({ op: "prepare", content: text, ownershipConfirmed: ownership }, "Declaração revista — a aguardar assinatura.")} loading={busy}>
                {decl.status === "aguardando_assinatura" ? "Guardar revisão" : "Preparar e enviar para assinatura"}
              </Button>
            )}
            {decl.status === "aguardando_assinatura" && (
              <Button onClick={() => setConfirmSign(true)} className="bg-emerald-700 hover:bg-emerald-800">
                <PenLine className="h-4 w-4" /> Assinar e emitir
              </Button>
            )}
            {decl.pdfFileId && (
              <a href={`/api/files/${decl.pdfFileId}`} target="_blank" rel="noreferrer" className={buttonClass("outline")}>
                <Download className="h-4 w-4" /> PDF
              </a>
            )}
          </div>
          {!["emitida", "rejeitada", "cancelada", "anulada"].includes(decl.status) && (
            <div className="flex flex-col gap-2 border-t border-graphite-100 pt-3 sm:flex-row sm:items-end">
              <Field label="Motivo (rejeição)" className="flex-1">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <Button variant="outline" className="text-red-600" onClick={() => void op({ op: "reject", reason }, "Pedido rejeitado — morador notificado.")}>
                Rejeitar
              </Button>
              <Button variant="ghost" onClick={() => void op({ op: "cancel", reason }, "Pedido cancelado.")}>
                Cancelar
              </Button>
            </div>
          )}
          {decl.status === "emitida" && (
            <div className="flex flex-col gap-2 border-t border-graphite-100 pt-3 sm:flex-row sm:items-end">
              <Field label="Motivo da anulação" className="flex-1">
                <Input value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <Button variant="outline" className="text-red-600" onClick={() => void op({ op: "revoke", reason }, "Documento anulado — a verificação por QR passa a indicar “anulada”.")}>
                Anular documento
              </Button>
            </div>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wider text-graphite-500 uppercase">Histórico</p>
          <ol className="space-y-2 text-xs text-graphite-600">
            {decl.history.map((h, i) => (
              <li key={i}>
                <span className="text-graphite-400">{formatDateTime(h.at)}</span>
                <br />
                <strong>{h.by}</strong> — {h.text}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <Modal
        open={confirmSign}
        onClose={() => setConfirmSign(false)}
        size="sm"
        title="Assinar e emitir?"
        description="A sua imagem de assinatura será aplicada a este documento, o PDF é gerado com código QR de verificação e fica disponível para o morador. A operação fica registada (utilizador, data, hora e documento)."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmSign(false)}>
              Cancelar
            </Button>
            <Button className="bg-emerald-700 hover:bg-emerald-800" loading={busy} onClick={() => (setConfirmSign(false), void op({ op: "sign", confirm: true }, "Declaração assinada e emitida."))}>
              Confirmo e assino
            </Button>
          </>
        }
      >
        <p className="text-sm text-graphite-600">Documento {decl.number}.</p>
      </Modal>
    </Modal>
  );
}
