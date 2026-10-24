"use client";

import { AlertTriangle, CheckCircle2, Download, FileDown, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { CheckState, MoveOut, PaymentProof } from "@/types";
import { useDemoStore, accountFor } from "@/store/demo-store";
import { useSession } from "@/hooks/use-session";
import { can } from "@/config/permissions";
import { roleLabels } from "@/data/users";
import { cn, formatDate, formatDateTime, formatKz } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProofInput } from "@/components/app/widgets/proof-input";
import { fileSrc } from "@/lib/api-client";

export const CHECK_ITEMS: { key: keyof MoveOut["operational"]["checklist"]; label: string }[] = [
  { key: "apartamento", label: "Estado do apartamento" },
  { key: "ocorrencias", label: "Ocorrências pendentes" },
  { key: "equipamentos", label: "Equipamentos e acessos" },
  { key: "chaves", label: "Entrega de chaves e cartões" },
  { key: "danos", label: "Danos documentados" },
  { key: "outras", label: "Outras verificações" },
];
const CHECK_STATES: { id: CheckState; label: string }[] = [
  { id: "pendente", label: "Pendente" },
  { id: "conforme", label: "Conforme" },
  { id: "com_pendencias", label: "Com pendências" },
  { id: "nao_aplicavel", label: "Não aplicável" },
];
export const MOVEOUT_STEPS: { id: MoveOut["status"]; label: string }[] = [
  { id: "solicitacao_recebida", label: "Solicitação recebida" },
  { id: "em_verificacao_financeira", label: "Verificação financeira" },
  { id: "em_verificacao_operacional", label: "Verificação operacional" },
  { id: "aguardando_aprovacao", label: "Aguardando aprovação" },
  { id: "autorizada", label: "Autorizada" },
  { id: "concluida", label: "Concluída" },
];

function run(fn: () => void, ok: string) {
  try {
    fn();
    toast.success(ok);
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Operação não permitida.");
    return false;
  }
}

export function MoveOutStepper({ status }: { status: MoveOut["status"] }) {
  const idx = status === "regularizacao_pendente" ? 1 : MOVEOUT_STEPS.findIndex((s) => s.id === status);
  return (
    <ol className="flex flex-wrap gap-2 text-[11px]">
      {MOVEOUT_STEPS.map((s, i) => (
        <li key={s.id} className={cn("rounded-full px-2.5 py-1", status === "cancelada" ? "bg-graphite-100 text-graphite-400" : i < idx ? "bg-emerald-50 text-emerald-700" : i === idx ? "bg-navy-900 text-white" : "bg-graphite-100 text-graphite-500")}>
          {i + 1}. {i === 1 && status === "regularizacao_pendente" ? "Regularização pendente" : s.label}
        </li>
      ))}
    </ol>
  );
}

/** Painel do processo: conta corrente, verificações, encargos, autorização e declaração. */
export function MoveOutDetail({ id }: { id: string }) {
  const session = useSession();
  const role = session?.role;
  const m = useDemoStore((s) => s.moveOuts.find((x) => x.id === id));
  const state = useDemoStore();
  const charges = state.charges.filter((c) => c.moveOutId === id || (m && c.apartmentId === m.apartmentId));
  const [finNotes, setFinNotes] = useState("");
  const [authNotes, setAuthNotes] = useState("");
  const [checklist, setChecklist] = useState(m?.operational.checklist);
  const [opNotes, setOpNotes] = useState(m?.operational.notes ?? "");
  const [report, setReport] = useState<PaymentProof | null>(m?.operational.report ? { name: m.operational.report.name, type: "application/pdf", size: 0, dataUrl: m.operational.report.dataUrl, fileId: m.operational.report.fileId } : null);
  const [charge, setCharge] = useState({ description: "", justification: "", amount: "" });
  if (!m || !checklist) return null;

  const acc = accountFor(state, m);
  const closed = ["autorizada", "concluida", "cancelada"].includes(m.status);
  const isOwner = role === "morador" && session?.residentId === m.residentId;
  const canFin = can(role, "moveout.financial");
  const canOp = can(role, "moveout.operational");
  const canAuth = can(role, "moveout.authorize");

  const extract = () =>
    import("@/lib/finance-docs").then((d) =>
      d.downloadStatement({ title: "Extracto de conta corrente — processo de desocupação", ref: `Processo ${m.reference}`, resident: m.residentName, apartment: `Bloco ${m.block} · ${m.number}`, typology: m.typology, from: acc.from }, acc),
    );
  const declaration = () =>
    import("@/lib/finance-docs").then((d) =>
      d.downloadClearance({ reference: m.reference, residentName: m.residentName, block: m.block, number: m.number, typology: m.typology, plannedDate: m.plannedDate, authorization: { ...m.authorization!, role: roleLabels[m.authorization!.role] }, financialBy: m.financial.by, operationalBy: m.operational.by }),
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs tracking-widest text-graphite-400 uppercase">Processo {m.reference}</p>
          <h2 className="font-display text-2xl text-navy-900">
            {m.residentName} · Bloco {m.block} · {m.number} <span className="text-base text-graphite-500">({m.typology})</span>
          </h2>
          <p className="text-sm text-graphite-500">
            Saída prevista {formatDate(m.plannedDate)} · contacto {m.contact}
            {m.reason ? ` · motivo: ${m.reason}` : ""}
          </p>
        </div>
        <StatusBadge status={m.status} />
      </div>
      <MoveOutStepper status={m.status} />

      {/* conta corrente */}
      <Card>
        <CardHeader
          title="Conta corrente do período de ocupação"
          description={acc.from ? `Desde ${formatDate(acc.from)} · emissão automática` : "Emissão automática"}
          action={
            <Button size="sm" variant="outline" onClick={extract}>
              <FileDown className="h-3.5 w-3.5" /> Extracto PDF
            </Button>
          }
        />
        <div className="grid grid-cols-2 gap-px bg-graphite-100 lg:grid-cols-4">
          {[
            ["Quotas emitidas", acc.quotasTotal],
            ["Valores pagos", acc.paidTotal],
            ["Em validação", acc.inValidation],
            ["Quotas vencidas", acc.overdue],
            ["Encargos adicionais", acc.charges],
            ["Reservas por liquidar", acc.reservationsUnpaid],
            ["Créditos / antecipados", acc.credits],
            ["Saldo final em aberto", acc.confirmedDebt + acc.inValidation],
          ].map(([k, v]) => (
            <div key={k as string} className="bg-white px-4 py-3">
              <p className="text-[11px] text-graphite-500">{k}</p>
              <p className="mt-0.5 font-semibold text-navy-900 tabular-nums">{formatKz(v as number)}</p>
            </div>
          ))}
        </div>
        {acc.canIssueClearance ? (
          <p className="flex items-center gap-2 bg-emerald-50 px-5 py-3 text-sm text-emerald-800" data-testid="moveout-clear">
            <CheckCircle2 className="h-4 w-4" /> Sem valores em dívida confirmados nem pagamentos por validar.
          </p>
        ) : (
          <div className="bg-amber-50 px-5 py-3 text-sm text-amber-900" data-testid="moveout-debts">
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" /> Regularização Financeira Pendente
            </p>
            <ul className="mt-2 space-y-1">
              {acc.openItems.map((o, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>
                    {o.origin}: {o.description}
                  </span>
                  <span className="font-medium tabular-nums">{formatKz(o.amount)}</span>
                </li>
              ))}
              {acc.inValidation > 0 && (
                <li className="flex justify-between gap-3">
                  <span>Pagamentos submetidos em validação ({acc.inValidationCount})</span>
                  <span className="font-medium tabular-nums">{formatKz(acc.inValidation)}</span>
                </li>
              )}
            </ul>
            {isOwner && (
              <p className="mt-2 text-xs">
                Para regularizar, submeta os comprovativos em <a href="/painel/minhas-quotas" className="font-medium underline">Minhas quotas</a>
                {acc.reservationsUnpaid ? <> e em <a href="/painel/reservas" className="font-medium underline">Reservas</a></> : null}. A conta corrente é recalculada após a validação.
              </p>
            )}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* verificação financeira */}
        <Card>
          <CardHeader title="Verificação financeira" description="Gestor Financeiro" action={<StatusBadge status={m.financial.status === "pendente" ? "pendente" : m.financial.status} />} />
          <CardBody className="space-y-3 text-sm">
            {m.financial.by && (
              <p className="text-graphite-600">
                Última verificação: {m.financial.by} · {formatDateTime(m.financial.at!)}
                {m.financial.notes ? ` — ${m.financial.notes}` : ""}
              </p>
            )}
            {canFin && !closed && (
              <>
                <Field label="Observações">
                  <Textarea rows={2} value={finNotes} onChange={(e) => setFinNotes(e.target.value)} />
                </Field>
                <Button onClick={() => run(() => state.runFinancialCheck(m.id, finNotes.trim() || undefined), "Verificação financeira registada")}>{m.financial.by ? "Recalcular e verificar" : "Executar verificação financeira"}</Button>
              </>
            )}
          </CardBody>
        </Card>

        {/* verificação operacional */}
        <Card>
          <CardHeader title="Verificação operacional" description="Gestor Operacional — vistoria" action={<StatusBadge status={m.operational.status} />} />
          <CardBody className="space-y-3 text-sm">
            {CHECK_ITEMS.map((it) => (
              <div key={it.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_10rem] sm:items-center">
                <span className="text-graphite-700">{it.label}</span>
                {canOp && !closed ? (
                  <Select value={checklist[it.key].state} onChange={(e) => setChecklist({ ...checklist, [it.key]: { ...checklist[it.key], state: e.target.value as CheckState } })} aria-label={it.label}>
                    {CHECK_STATES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <StatusBadge status={m.operational.checklist[it.key].state} />
                )}
                {canOp && !closed && checklist[it.key].state === "com_pendencias" && (
                  <Input className="sm:col-span-2" placeholder="Descreva a pendência" value={checklist[it.key].notes ?? ""} onChange={(e) => setChecklist({ ...checklist, [it.key]: { ...checklist[it.key], notes: e.target.value } })} />
                )}
              </div>
            ))}
            {m.operational.report && (
              <p className="text-xs text-graphite-600">
                Relatório de vistoria:{" "}
                {fileSrc(m.operational.report) ? (
                  <a href={fileSrc(m.operational.report)} target="_blank" rel="noreferrer" className="font-medium text-navy-700 underline">
                    {m.operational.report.name}
                  </a>
                ) : (
                  m.operational.report.name
                )}
              </p>
            )}
            {m.operational.notes && !canOp && <p className="text-xs text-graphite-600">Observações: {m.operational.notes}</p>}
            {canOp && !closed && (
              <>
                <Field label="Observações da vistoria">
                  <Textarea rows={2} value={opNotes} onChange={(e) => setOpNotes(e.target.value)} />
                </Field>
                <ProofInput value={report} onChange={setReport} label="Anexar relatório de vistoria (PDF ou imagem)" />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => run(() => state.saveOperationalCheck(m.id, { checklist, notes: opNotes, report: report ? { name: report.name, dataUrl: report.dataUrl, fileId: report.fileId } : undefined }), "Vistoria guardada")}>
                    Guardar
                  </Button>
                  <Button onClick={() => run(() => state.saveOperationalCheck(m.id, { checklist, notes: opNotes, report: report ? { name: report.name, dataUrl: report.dataUrl, fileId: report.fileId } : undefined, conclude: true }), "Verificação operacional concluída")}>Concluir verificação</Button>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* encargos adicionais */}
      {(canFin || canOp || can(role, "charges.confirm") || charges.length > 0) && (
        <Card>
          <CardHeader title="Encargos adicionais" description="Só são cobrados com registo, fundamentação e validação administrativa." />
          <ul className="divide-y divide-graphite-100 text-sm">
            {charges.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <span className="font-medium text-navy-900">{c.description}</span> — {formatKz(c.amount)}
                  <span className="block text-xs text-graphite-500">
                    {c.justification} · proposto por {c.proposedBy}
                    {c.confirmedBy ? ` · validado por ${c.confirmedBy}` : ""}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={c.status} />
                  {can(role, "charges.confirm") && c.status === "proposto" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => run(() => state.decideCharge(c.id, "confirmado"), "Encargo validado")}>
                        Validar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => run(() => state.decideCharge(c.id, "anulado"), "Encargo anulado")}>
                        Anular
                      </Button>
                    </>
                  )}
                  {can(role, "payments.register") && c.status === "confirmado" && (
                    <Button size="sm" variant="outline" onClick={() => run(() => state.decideCharge(c.id, "pago"), "Encargo liquidado")}>
                      Registar liquidação
                    </Button>
                  )}
                </span>
              </li>
            ))}
            {!charges.length && <li className="px-5 py-4 text-xs text-graphite-400">Sem encargos adicionais registados.</li>}
          </ul>
          {can(role, "charges.propose") && !closed && (
            <div className="grid gap-3 border-t border-graphite-100 p-5 sm:grid-cols-[1fr_1fr_9rem_auto] sm:items-end">
              <Field label="Descrição">
                <Input value={charge.description} onChange={(e) => setCharge({ ...charge, description: e.target.value })} placeholder="Ex.: Reparação de porta danificada" />
              </Field>
              <Field label="Fundamentação">
                <Input value={charge.justification} onChange={(e) => setCharge({ ...charge, justification: e.target.value })} placeholder="Relatório de vistoria / orçamento" />
              </Field>
              <Field label="Valor (Kz)">
                <Input type="number" min={1} value={charge.amount} onChange={(e) => setCharge({ ...charge, amount: e.target.value })} />
              </Field>
              <Button
                variant="outline"
                onClick={() => {
                  if (run(() => state.proposeCharge({ apartmentId: m.apartmentId, moveOutId: m.id, description: charge.description.trim(), justification: charge.justification.trim(), amount: Number(charge.amount) }), "Encargo proposto — aguarda validação administrativa"))
                    setCharge({ description: "", justification: "", amount: "" });
                }}
              >
                Propor
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* autorização */}
      <Card>
        <CardHeader title="Autorização administrativa de saída" description="Emitida pelo Gestor Operacional ou pelo Gestor Financeiro — uma única autorização por processo" action={<ShieldCheck className="h-4 w-4 text-graphite-400" />} />
        <CardBody className="space-y-3 text-sm">
          {m.authorization ? (
            <>
              <p className="text-emerald-800">
                Autorizada por <strong>{m.authorization.by}</strong> ({roleLabels[m.authorization.role]}) em {formatDateTime(m.authorization.at)}
                {m.authorization.notes ? ` — ${m.authorization.notes}` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={declaration}>
                  <Download className="h-4 w-4" /> Declaração de Regularização e Autorização (PDF)
                </Button>
                {m.status === "autorizada" && can(role, "moveout.complete") && (
                  <Button variant="outline" onClick={() => run(() => state.completeMoveOut(m.id), "Desocupação concluída — fracção disponível, histórico preservado")}>
                    Registar desocupação concluída
                  </Button>
                )}
              </div>
            </>
          ) : canAuth && m.status !== "cancelada" ? (
            <>
              {!acc.canIssueClearance && <p className="text-amber-800">A declaração não pode ser emitida enquanto existirem dívidas confirmadas ou pagamentos por validar.</p>}
              <Field label="Observações">
                <Textarea rows={2} value={authNotes} onChange={(e) => setAuthNotes(e.target.value)} />
              </Field>
              <Button onClick={() => run(() => state.authorizeMoveOut(m.id, authNotes.trim() || undefined), "Saída autorizada — declaração disponível")}>Autorizar saída</Button>
            </>
          ) : (
            <p className="text-graphite-500">{m.status === "cancelada" ? "Processo cancelado." : "A aguardar a conclusão das verificações e a autorização."}</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Histórico do processo" />
        <ol className="space-y-1.5 px-5 pb-5 text-xs text-graphite-600">
          {m.history.map((h) => (
            <li key={h.id}>
              <span className="text-graphite-400">{formatDateTime(h.at)}</span> · <strong className="text-graphite-700">{h.by}</strong> — {h.text}
            </li>
          ))}
        </ol>
      </Card>

      {!["concluida", "cancelada", "autorizada"].includes(m.status) && (isOwner || can(role, "moveout.complete")) && (
        <Button variant="ghost" className="text-red-600" onClick={() => run(() => state.cancelMoveOut(m.id, isOwner ? "Cancelado pelo morador" : "Cancelado pela gestão"), "Processo cancelado")}>
          Cancelar processo
        </Button>
      )}
    </div>
  );
}
