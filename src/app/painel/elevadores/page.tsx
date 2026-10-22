"use client";

import { ArrowUpDown, History, Info, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Elevator, ElevatorStatus } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { useCurrentResident } from "@/hooks/use-session";
import { can } from "@/config/permissions";
import { BLOCKS } from "@/data/management";
import { formatDate, formatDateTime, uid } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { ElevatorGrid, ELEVATOR_STATUS } from "@/components/app/widgets/elevator-grid";

const EVENT_LABEL = { avaria: "Avaria", intervencao: "Intervenção", manutencao: "Manutenção", estado: "Alteração de estado" } as const;

export default function ElevadoresPage() {
  const { session, apartment } = useCurrentResident();
  const elevators = useDemoStore((s) => s.elevators);
  const deleteElevator = useDemoStore((s) => s.deleteElevator);
  const canManage = can(session?.role, "elevators.manage");
  const isResident = session?.role === "morador";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Elevator | "new" | null>(null);
  const [deleting, setDeleting] = useState<Elevator | null>(null);
  const sorted = useMemo(() => [...elevators].sort((a, b) => (a.block + a.code).localeCompare(b.block + b.code)), [elevators]);
  const selected = elevators.find((e) => e.id === selectedId) ?? null;
  const count = (s: ElevatorStatus) => elevators.filter((e) => e.status === s).length;

  return (
    <>
      <PageHeader
        eyebrow={isResident ? "Minha área" : "Operações"}
        title={isResident ? "Estado dos elevadores" : "Elevadores"}
        description={canManage ? "Inventário, estado, manutenção e histórico de avarias por bloco." : isResident ? "Consulte o estado actual dos elevadores do condomínio." : "Consulta do estado e histórico dos elevadores (gerido pelo Gestor Operacional)."}
        actions={
          canManage && (
            <Button onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" /> Adicionar elevador
            </Button>
          )
        }
      />
      {elevators.some((e) => e.demo) && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-3.5 text-sm text-amber-900">
          <Info className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            <strong>Inventário de demonstração:</strong> foi considerado 1 elevador por bloco apenas para teste. A quantidade real de elevadores por bloco
            {canManage ? " deve ser configurada aqui (adicionar, editar ou remover equipamentos)." : " será configurada pelo Gestor Operacional."}
          </p>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard index={0} label="Operacionais" value={count("operacional")} icon={ArrowUpDown} tone="success" />
        <StatCard index={1} label="Avariados" value={count("avariado")} icon={ArrowUpDown} tone="danger" />
        <StatCard index={2} label="Em manutenção" value={count("em_manutencao")} icon={Wrench} tone="warning" />
        <StatCard index={3} label="Fora de serviço" value={count("fora_servico")} icon={ArrowUpDown} tone="navy" />
      </div>

      <Card>
        <CardHeader title="Estado actual" description={isResident && apartment ? `O seu bloco (${apartment.block}) está destacado` : "Clique num elevador para ver o detalhe e o histórico"} />
        <CardBody>
          <ElevatorGrid elevators={sorted} onSelect={(e) => setSelectedId(e.id)} highlightBlock={apartment?.block} />
        </CardBody>
      </Card>

      {!isResident && (
        <Card className="mt-6">
          <CardHeader title="Inventário" />
          <DataTable
            rows={sorted}
            rowKey={(e) => e.id}
            onRowClick={(e) => setSelectedId(e.id)}
            columns={[
              { key: "code", header: "Elevador", primary: true, cell: (e) => <span className="font-semibold text-navy-900">{e.code}</span> },
              { key: "block", header: "Bloco", cell: (e) => e.block },
              { key: "status", header: "Estado", cell: (e) => <StatusBadge status={e.status} /> },
              { key: "last", header: "Última manutenção", cell: (e) => (e.lastMaintenance ? formatDate(e.lastMaintenance) : "—") },
              { key: "next", header: "Próxima manutenção", cell: (e) => (e.nextMaintenance ? formatDate(e.nextMaintenance) : "—") },
              { key: "prov", header: "Responsável", cell: (e) => e.provider, hideOnMobile: true },
              {
                key: "actions",
                header: "",
                align: "right",
                cell: (e) =>
                  canManage ? (
                    <div className="flex justify-end gap-1" onClick={(ev) => ev.stopPropagation()}>
                      <Button size="sm" variant="subtle" onClick={() => setSelectedId(e.id)}>
                        Actualizar
                      </Button>
                      <button onClick={() => setEditing(e)} className="rounded-lg p-2 text-graphite-500 hover:bg-navy-50" aria-label="Editar dados">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleting(e)} className="rounded-lg p-2 text-graphite-500 hover:bg-red-50 hover:text-red-600" aria-label="Remover">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setSelectedId(e.id)}>
                      Ver
                    </Button>
                  ),
              },
            ]}
          />
        </Card>
      )}

      <ElevatorDetail elevator={selected} canManage={canManage} showHistory={!isResident} onClose={() => setSelectedId(null)} />
      <ElevatorForm key={editing === "new" ? "new" : editing?.id ?? "x"} open={editing !== null} elevator={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Remover ${deleting?.code}?`}
        description="Use esta opção para corrigir o inventário (ex.: equipamento inexistente)."
        confirmLabel="Remover"
        onConfirm={() => {
          if (!deleting) return;
          try {
            deleteElevator(deleting.id);
            toast.success("Elevador removido do inventário.");
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    </>
  );
}

function ElevatorDetail({ elevator, canManage, showHistory, onClose }: { elevator: Elevator | null; canManage: boolean; showHistory: boolean; onClose: () => void }) {
  const setStatus = useDemoStore((s) => s.setElevatorStatus);
  const [status, setStatusValue] = useState<ElevatorStatus>("avariado");
  const [type, setType] = useState<"avaria" | "intervencao" | "manutencao" | "estado">("avaria");
  const [description, setDescription] = useState("");
  const [createOcc, setCreateOcc] = useState(true);

  const submit = () => {
    if (!elevator) return;
    if (description.trim().length < 5) return toast.error("Descreva a situação ou a intervenção.");
    try {
      setStatus(elevator.id, status, { type, description: description.trim(), createOccurrence: status === "avariado" && createOcc });
      toast.success(`${elevator.code}: ${ELEVATOR_STATUS[status].label}`, { description: status === "avariado" && createOcc ? "Ocorrência urgente criada e visível no dashboard executivo." : "Indicadores actualizados." });
      setDescription("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Modal open={!!elevator} onClose={onClose} size="lg" title={elevator?.code} description={elevator ? `Bloco ${elevator.block} · ${elevator.provider}` : ""}>
      {elevator && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={elevator.status} />
            {elevator.demo && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] text-amber-800">Registo de demonstração</span>}
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-graphite-50 p-3">
              <dt className="text-xs text-graphite-500">Última manutenção</dt>
              <dd className="font-medium text-navy-900">{elevator.lastMaintenance ? formatDate(elevator.lastMaintenance) : "—"}</dd>
            </div>
            <div className="rounded-xl bg-graphite-50 p-3">
              <dt className="text-xs text-graphite-500">Próxima manutenção</dt>
              <dd className="font-medium text-navy-900">{elevator.nextMaintenance ? formatDate(elevator.nextMaintenance) : "—"}</dd>
            </div>
          </dl>
          {elevator.notes && <p className="text-sm text-graphite-600">{elevator.notes}</p>}

          {canManage && (
            <div className="rounded-2xl border border-navy-100 bg-navy-50/40 p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy-900">
                <Wrench className="h-4 w-4" /> Actualizar estado / registar intervenção
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tipo de registo">
                  <Select
                    value={type}
                    onChange={(e) => {
                      const t = e.target.value as typeof type;
                      setType(t);
                      setStatusValue(t === "avaria" ? "avariado" : t === "manutencao" ? "em_manutencao" : "operacional");
                    }}
                  >
                    {Object.entries(EVENT_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Novo estado">
                  <Select value={status} onChange={(e) => setStatusValue(e.target.value as ElevatorStatus)}>
                    {(Object.keys(ELEVATOR_STATUS) as ElevatorStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {ELEVATOR_STATUS[s].label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Descrição" className="sm:col-span-2">
                  <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Elevador parado no 3.º piso; técnico contactado." />
                </Field>
                {status === "avariado" && (
                  <label className="flex items-center gap-2 text-xs text-graphite-700 sm:col-span-2">
                    <input type="checkbox" className="h-4 w-4 accent-navy-900" checked={createOcc} onChange={(e) => setCreateOcc(e.target.checked)} />
                    Criar ocorrência urgente associada (categoria Elevadores)
                  </label>
                )}
                {status === "operacional" && <p className="text-xs text-graphite-500 sm:col-span-2">Ao repor em funcionamento, as ocorrências abertas deste elevador são marcadas como resolvidas.</p>}
              </div>
              <div className="mt-3 flex justify-end">
                <Button onClick={submit}>Registar</Button>
              </div>
            </div>
          )}

          {showHistory && (
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy-900">
                <History className="h-4 w-4" /> Histórico de avarias e intervenções
              </p>
              <ol className="relative space-y-3 border-l border-graphite-200 pl-5">
                {[...elevator.history].reverse().map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full ring-4 ring-white" style={{ background: h.type === "avaria" ? "#dc2626" : h.type === "manutencao" ? "#d97706" : "#15803d" }} />
                    <p className="text-sm text-navy-900">
                      <strong>{EVENT_LABEL[h.type]}</strong> · {h.description}
                    </p>
                    <p className="text-xs text-graphite-500">
                      {formatDateTime(h.at)} · {h.by} · <StatusBadge status={h.status} />
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function ElevatorForm({ open, elevator, onClose }: { open: boolean; elevator: Elevator | null; onClose: () => void }) {
  const saveElevator = useDemoStore((s) => s.saveElevator);
  const elevators = useDemoStore((s) => s.elevators);
  const [block, setBlock] = useState(elevator?.block ?? "01");
  const [code, setCode] = useState(elevator?.code ?? "");
  const [provider, setProvider] = useState(elevator?.provider ?? "Prestador de elevadores (a definir)");
  const [last, setLast] = useState(elevator?.lastMaintenance ?? "");
  const [next, setNext] = useState(elevator?.nextMaintenance ?? "");
  const [notes, setNotes] = useState(elevator?.notes ?? "");

  const save = () => {
    const c = code.trim() || `ELV-${block}-${String.fromCharCode(65 + elevators.filter((e) => e.block === block).length)}`;
    if (elevators.some((e) => e.code === c && e.id !== elevator?.id)) return toast.error("Já existe um elevador com esta identificação.");
    try {
      saveElevator({
        id: elevator?.id ?? uid("elv"),
        block,
        code: c,
        status: elevator?.status ?? "operacional",
        provider: provider.trim() || "A definir",
        lastMaintenance: last || undefined,
        nextMaintenance: next || undefined,
        notes: notes.trim() || undefined,
        demo: false,
        history: elevator?.history ?? [],
      });
      toast.success(elevator ? "Dados do elevador actualizados" : `Elevador ${c} adicionado ao inventário`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={elevator ? `Editar ${elevator.code}` : "Adicionar elevador"} footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={save}>Guardar</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bloco">
          <Select value={block} onChange={(e) => setBlock(e.target.value)}>
            {BLOCKS.map((b) => (
              <option key={b} value={b}>
                Bloco {b}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Identificação" hint="Vazio = gerada automaticamente">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={`ELV-${block}-B`} />
        </Field>
        <Field label="Empresa ou técnico responsável" className="sm:col-span-2">
          <Input value={provider} onChange={(e) => setProvider(e.target.value)} />
        </Field>
        <Field label="Última manutenção">
          <Input type="date" value={last} onChange={(e) => setLast(e.target.value)} />
        </Field>
        <Field label="Próxima manutenção">
          <Input type="date" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
