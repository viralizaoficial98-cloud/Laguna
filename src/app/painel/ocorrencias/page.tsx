"use client";

import { Camera, Eye, MessageSquarePlus, Plus, ShieldAlert, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Occurrence, OccurrenceCategory, OccurrencePriority, OccurrenceStatus } from "@/types";
import { useDemoStore, aptLabel } from "@/store/demo-store";
import { useCurrentResident } from "@/hooks/use-session";
import { useOperations } from "@/hooks/use-operations";
import { can } from "@/config/permissions";
import { BLOCKS } from "@/data/management";
import { GESTOR_NAME, OCCURRENCE_CATEGORIES, TEAMS } from "@/data/operations";
import { cn, formatDateTime, includesText, uid } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/search-input";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Toolbar } from "@/components/ui/toolbar";
import { Tabs } from "@/components/ui/tabs";
import { Modal } from "@/components/ui/modal";
import { StatusBadge, statusLabel, occStatus } from "@/components/ui/status-badge";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { Donut, HBars } from "@/components/charts/charts";

const PRIORITIES: OccurrencePriority[] = ["baixa", "media", "alta", "urgente"];
const STATUSES: OccurrenceStatus[] = ["aberta", "em_analise", "em_execucao", "resolvida"];
const ASSIGNEES = [GESTOR_NAME, ...TEAMS.limpeza, ...TEAMS.jardinagem, ...TEAMS.manutencao];

export default function OcorrenciasPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { session } = useCurrentResident();
  const all = useDemoStore((s) => s.occurrences);
  const apartments = useDemoStore((s) => s.apartments);
  const canManage = can(session?.role, "occurrences.manage");
  const isResident = session?.role === "morador";
  const ops = useOperations();

  const [tab, setTab] = useState<"todas" | OccurrenceStatus>("todas");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [prio, setPrio] = useState("");
  const [block, setBlock] = useState("");
  const [open, setOpen] = useState(params.get("nova") === "1");
  const [selId, setSelId] = useState<string | null>(null);

  // morador: apenas as próprias ocorrências
  const visible = useMemo(() => (isResident ? all.filter((o) => o.residentId === session?.residentId) : all), [all, isResident, session]);
  const rows = useMemo(
    () =>
      visible
        .filter((o) => (tab === "todas" || o.status === tab) && (!cat || o.category === cat) && (!prio || o.priority === prio) && (!block || o.block === block))
        .filter((o) => includesText([o.title, o.description, o.location, o.assignee], q))
        .sort(
          (a, b) =>
            Number(a.status === "resolvida") - Number(b.status === "resolvida") ||
            (a.status !== "resolvida" ? PRIORITIES.indexOf(b.priority) - PRIORITIES.indexOf(a.priority) : 0) ||
            b.createdAt.localeCompare(a.createdAt),
        ),
    [visible, tab, cat, prio, block, q],
  );
  const sel = all.find((o) => o.id === selId) ?? null;
  const count = (s: OccurrenceStatus) => visible.filter((o) => o.status === s).length;

  const closeForm = () => {
    setOpen(false);
    if (params.get("nova")) router.replace("/painel/ocorrencias");
  };

  return (
    <>
      <PageHeader
        eyebrow={isResident ? "Minha área" : "Operações"}
        title={isResident ? "Minhas ocorrências" : "Ocorrências"}
        description={
          canManage
            ? "Registo, classificação, atribuição, acompanhamento e resolução de ocorrências."
            : isResident
              ? "Comunique problemas nas áreas comuns ou no seu bloco e acompanhe o tratamento."
              : "Consulta e supervisão das ocorrências geridas pelo Gestor Operacional."
        }
        actions={
          (canManage || isResident) && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> {isResident ? "Comunicar ocorrência" : "Registar ocorrência"}
            </Button>
          )
        }
      />

      {!isResident && (
        <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card>
            <CardHeader title="Por categoria" />
            <CardBody>
              <HBars data={ops.occurrences.byCategory} height={230} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Por prioridade" />
            <CardBody>
              <Donut data={ops.occurrences.byPriority.map((p) => ({ key: p.key, label: statusLabel(p.key), value: p.value }))} height={150} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Abertas por bloco" description={`${ops.occurrences.open} abertas · ${ops.occurrences.avgResolutionDays.toFixed(1)} dias de resolução média`} />
            <CardBody>
              <div className="grid grid-cols-5 gap-2">
                {ops.occurrences.byBlock.map((b) => (
                  <button
                    key={b.label}
                    onClick={() => setBlock(block === b.label ? "" : b.label)}
                    className={cn("rounded-xl border p-2 text-center transition", block === b.label ? "border-navy-900 ring-2 ring-navy-100" : "border-graphite-100", b.abertas > 2 ? "bg-red-50" : b.abertas > 0 ? "bg-amber-50" : "bg-emerald-50")}
                  >
                    <span className="block text-[10px] text-graphite-500">Bloco</span>
                    <span className="block text-sm font-semibold text-navy-900">{b.label}</span>
                    <span className="block text-xs font-medium text-graphite-700 tabular-nums">{b.abertas}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-graphite-400">Verde: sem ocorrências abertas · laranja: 1–2 · vermelho: 3 ou mais</p>
            </CardBody>
          </Card>
        </div>
      )}

      <Card>
        <Toolbar>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[{ id: "todas" as const, label: "Todas", count: visible.length }, ...STATUSES.map((s) => ({ id: s, label: statusLabel(s), count: count(s) }))]}
          />
        </Toolbar>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Pesquisar ocorrências…" className="sm:w-64" />
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <Select value={cat} onChange={(e) => setCat(e.target.value)} className="sm:w-44" aria-label="Categoria">
              <option value="">Categorias</option>
              {OCCURRENCE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Select value={prio} onChange={(e) => setPrio(e.target.value)} className="sm:w-36" aria-label="Prioridade">
              <option value="">Prioridades</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {statusLabel(p)}
                </option>
              ))}
            </Select>
            {!isResident && (
              <Select value={block} onChange={(e) => setBlock(e.target.value)} className="sm:w-36" aria-label="Bloco">
                <option value="">Blocos</option>
                {BLOCKS.map((b) => (
                  <option key={b} value={b}>
                    Bloco {b}
                  </option>
                ))}
              </Select>
            )}
          </div>
          <DemoDataNote className="sm:ml-auto" />
        </Toolbar>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(o) => setSelId(o.id)}
          emptyTitle={isResident ? "Ainda não comunicou ocorrências" : "Sem ocorrências"}
          columns={[
            { key: "title", header: "Ocorrência", primary: true, cell: (o) => <span className="font-medium text-navy-900">{o.title}</span> },
            { key: "cat", header: "Categoria", cell: (o) => o.category },
            { key: "block", header: "Bloco", cell: (o) => o.block ?? "Comum" },
            { key: "prio", header: "Prioridade", cell: (o) => <StatusBadge status={o.priority} /> },
            { key: "resp", header: "Responsável", cell: (o) => o.assignee ?? <span className="text-graphite-400">Por atribuir</span>, hideOnMobile: true },
            { key: "date", header: "Registo", cell: (o) => formatDateTime(o.createdAt), hideOnMobile: true },
            { key: "status", header: "Estado", cell: (o) => <StatusBadge status={occStatus(o.status)} /> },
            {
              key: "actions",
              header: "",
              align: "right",
              cell: (o) => (
                <Button size="sm" variant="ghost" onClick={() => setSelId(o.id)}>
                  <Eye className="h-3.5 w-3.5" /> {canManage ? "Gerir" : "Ver"}
                </Button>
              ),
            },
          ]}
        />
      </Card>

      {open && (isResident ? <ResidentForm onClose={closeForm} /> : <ManagerForm onClose={closeForm} />)}
      <OccurrenceDetail occurrence={sel} apartmentLabel={sel ? aptLabel(apartments, sel.apartmentId) : ""} onClose={() => setSelId(null)} />
    </>
  );
}

function PhotoPicker({ photos, onChange }: { photos: { name: string; dataUrl?: string }[]; onChange: (p: { name: string; dataUrl?: string }[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const add = (files: FileList) => {
    Array.from(files)
      .slice(0, 3 - photos.length)
      .forEach((file) => {
        if (!file.type.startsWith("image/") || file.size > 4 * 1024 * 1024) return toast.error(`${file.name}: imagem até 4 MB.`);
        const r = new FileReader();
        r.onload = () => onChange([...photos, { name: file.name, dataUrl: String(r.result) }]);
        r.readAsDataURL(file);
      });
  };
  return (
    <div>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && add(e.target.files)} />
      <div className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <span key={i} className="relative h-16 w-16 overflow-hidden rounded-lg border border-graphite-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.dataUrl && <img src={p.dataUrl} alt={p.name} className="h-full w-full object-cover" />}
            <button type="button" onClick={() => onChange(photos.filter((_, k) => k !== i))} className="absolute top-0.5 right-0.5 rounded bg-white/90 p-0.5" aria-label="Remover fotografia">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {photos.length < 3 && (
          <button type="button" onClick={() => ref.current?.click()} className="flex h-16 w-16 flex-col items-center justify-center rounded-lg border-2 border-dashed border-graphite-200 text-graphite-400 hover:border-navy-300">
            <Camera className="h-4 w-4" />
            <span className="text-[10px]">Foto</span>
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] text-graphite-400">Até 3 fotografias · guardadas apenas neste browser (demonstração).</p>
    </div>
  );
}

function ResidentForm({ onClose }: { onClose: () => void }) {
  const report = useDemoStore((s) => s.reportOccurrence);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<OccurrenceCategory>("Infraestruturas");
  const [location, setLocation] = useState("");
  const [photos, setPhotos] = useState<{ name: string; dataUrl?: string }[]>([]);
  const submit = () => {
    if (title.trim().length < 5 || description.trim().length < 5 || location.trim().length < 2) return toast.error("Preencha o título, a descrição e o local.");
    try {
      report({ title: title.trim(), description: description.trim(), category, location: location.trim(), photos });
      toast.success("Ocorrência enviada ao Gestor Operacional.");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <Modal open onClose={onClose} title="Comunicar ocorrência" description="A ocorrência fica associada à sua fracção." footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={submit}>Enviar</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Assunto" required className="sm:col-span-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Lâmpada fundida no hall" />
        </Field>
        <Field label="Categoria">
          <Select value={category} onChange={(e) => setCategory(e.target.value as OccurrenceCategory)}>
            {OCCURRENCE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Local" required>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Hall do 2.º piso" />
        </Field>
        <Field label="Descrição" required className="sm:col-span-2">
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <PhotoPicker photos={photos} onChange={setPhotos} />
        </div>
      </div>
    </Modal>
  );
}

function ManagerForm({ onClose }: { onClose: () => void }) {
  const save = useDemoStore((s) => s.saveOccurrence);
  const { session } = useCurrentResident();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<OccurrenceCategory>("Infraestruturas");
  const [priority, setPriority] = useState<OccurrencePriority>("media");
  const [block, setBlock] = useState("");
  const [location, setLocation] = useState("");
  const [assignee, setAssignee] = useState("");
  const [photos, setPhotos] = useState<{ name: string; dataUrl?: string }[]>([]);
  const submit = () => {
    if (title.trim().length < 5 || location.trim().length < 2) return toast.error("Indique o título e o local.");
    const now = new Date().toISOString();
    try {
      save({
        id: uid("oc"),
        title: title.trim(),
        description: description.trim() || title.trim(),
        category,
        priority,
        status: assignee ? "em_analise" : "aberta",
        block: block || undefined,
        location: location.trim(),
        assignee: assignee || undefined,
        photos,
        createdAt: now,
        reportedBy: session?.name ?? GESTOR_NAME,
        history: [{ id: uid("oh"), at: now, by: session?.name ?? GESTOR_NAME, role: "gestor", text: `Ocorrência registada${assignee ? ` e atribuída a ${assignee}` : ""}.`, status: assignee ? "em_analise" : "aberta" }],
      });
      toast.success("Ocorrência registada.");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <Modal open onClose={onClose} size="lg" title="Registar ocorrência" footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={submit}>Registar</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Título" required className="sm:col-span-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Categoria">
          <Select value={category} onChange={(e) => setCategory(e.target.value as OccurrenceCategory)}>
            {OCCURRENCE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Prioridade">
          <Select value={priority} onChange={(e) => setPriority(e.target.value as OccurrencePriority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {statusLabel(p)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Bloco">
          <Select value={block} onChange={(e) => setBlock(e.target.value)}>
            <option value="">Área comum</option>
            {BLOCKS.map((b) => (
              <option key={b} value={b}>
                Bloco {b}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Local" required>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Hall do 3.º piso" />
        </Field>
        <Field label="Responsável" className="sm:col-span-2">
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Por atribuir</option>
            {ASSIGNEES.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <PhotoPicker photos={photos} onChange={setPhotos} />
        </div>
      </div>
    </Modal>
  );
}

function OccurrenceDetail({ occurrence: o, apartmentLabel, onClose }: { occurrence: Occurrence | null; apartmentLabel: string; onClose: () => void }) {
  const { session } = useCurrentResident();
  const update = useDemoStore((s) => s.updateOccurrence);
  const addNote = useDemoStore((s) => s.addOccurrenceNote);
  const canManage = can(session?.role, "occurrences.manage");
  const canSupervise = can(session?.role, "occurrences.supervise");
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("");

  const run = (fn: () => void, msg: string) => {
    try {
      fn();
      toast.success(msg);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Modal open={!!o} onClose={onClose} size="lg" title={o?.title} description={o ? `${o.category} · ${o.location}${o.apartmentId ? ` · ${apartmentLabel}` : ""}` : ""}>
      {o && (
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={occStatus(o.status)} />
            <StatusBadge status={o.priority} />
            {o.elevatorId && <span className="rounded-full bg-navy-50 px-2.5 py-0.5 text-[11px] text-navy-800">Ligada ao elevador {o.elevatorId.replace("elv_", "Bloco ")}</span>}
          </div>
          <p className="rounded-xl bg-graphite-50 p-4 text-graphite-700">{o.description}</p>
          {o.photos && o.photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {o.photos.map((p, i) =>
                p.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={p.dataUrl} alt={p.name} className="h-24 w-24 rounded-lg border border-graphite-100 object-cover" />
                ) : (
                  <span key={i} className="rounded-lg bg-graphite-100 px-2 py-1 text-xs">{p.name}</span>
                ),
              )}
            </div>
          )}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div><dt className="text-xs text-graphite-500">Registada</dt><dd className="font-medium">{formatDateTime(o.createdAt)}</dd></div>
            <div><dt className="text-xs text-graphite-500">Reportada por</dt><dd className="font-medium">{o.reportedBy}</dd></div>
            <div><dt className="text-xs text-graphite-500">Responsável</dt><dd className="font-medium">{o.assignee ?? "Por atribuir"}</dd></div>
            <div><dt className="text-xs text-graphite-500">Resolvida</dt><dd className="font-medium">{o.resolvedAt ? formatDateTime(o.resolvedAt) : "—"}</dd></div>
          </dl>
          {o.resolution && <p className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-emerald-900"><strong>Resolução:</strong> {o.resolution}</p>}

          {canManage && (
            <div className="grid gap-3 rounded-2xl border border-navy-100 bg-navy-50/40 p-4 sm:grid-cols-3">
              <Field label="Estado">
                <Select value={o.status} onChange={(e) => run(() => update(o.id, { status: e.target.value as OccurrenceStatus }), "Estado actualizado")}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Prioridade">
                <Select value={o.priority} onChange={(e) => run(() => update(o.id, { priority: e.target.value as OccurrencePriority }), "Prioridade actualizada")}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {statusLabel(p)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Responsável">
                <Select value={o.assignee ?? ""} onChange={(e) => run(() => update(o.id, { assignee: e.target.value || undefined }), "Responsável atribuído")}>
                  <option value="">Por atribuir</option>
                  {ASSIGNEES.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </Select>
              </Field>
              {o.status !== "resolvida" && (
                <div className="flex gap-2 sm:col-span-3">
                  <Input value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Descrição da resolução" />
                  <Button
                    onClick={() => {
                      if (resolution.trim().length < 3) return toast.error("Descreva a resolução.");
                      run(() => update(o.id, { status: "resolvida", resolution: resolution.trim() }, resolution.trim()), "Ocorrência resolvida");
                      setResolution("");
                    }}
                  >
                    Registar resolução
                  </Button>
                </div>
              )}
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-semibold text-navy-900">Histórico</p>
            <ol className="space-y-1.5">
              {o.history.map((h) => (
                <li key={h.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-graphite-50 px-3 py-1.5 text-xs">
                  <span className={h.role === "administrador" ? "font-medium text-gold-800" : "text-graphite-700"}>{h.text}</span>
                  <span className="text-graphite-500 tabular-nums">
                    {formatDateTime(h.at)} · {h.by}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {canSupervise && (
            <div className="flex gap-2">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={session?.role === "administrador" ? "Nota de supervisão para o Gestor Operacional" : "Observação"} />
              <Button
                variant="outline"
                onClick={() => {
                  if (note.trim().length < 3) return;
                  run(() => addNote(o.id, note.trim()), "Nota registada no histórico");
                  setNote("");
                }}
              >
                <MessageSquarePlus className="h-4 w-4" /> Adicionar
              </Button>
            </div>
          )}
          {!canManage && !canSupervise && (
            <p className="flex items-center gap-2 text-xs text-graphite-500">
              <ShieldAlert className="h-3.5 w-3.5" /> A ocorrência é tratada pelo Gestor Operacional.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
