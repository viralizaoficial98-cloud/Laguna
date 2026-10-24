"use client";

import { AlertTriangle, CheckCircle2, Download, FileJson, HardDrive, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDemoStore } from "@/store/demo-store";
import { downloadBlob } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Chave usada pelas versões anteriores do portal (dados apenas neste navegador). */
const LEGACY_KEY = "laguna-demo-data";

const LABELS: Record<string, string> = {
  halls: "Salões",
  apartments: "Apartamentos",
  residents: "Moradores",
  occupancies: "Ocupações",
  quotas: "Quotas",
  payments: "Pagamentos",
  charges: "Encargos",
  expenses: "Despesas",
  reservations: "Reservas",
  moveOuts: "Desocupações",
  visits: "Visitas",
  visitChecks: "Entradas/saídas",
  accessLogs: "Acessos",
  circulars: "Circulares",
  notices: "Comunicados",
  documents: "Documentos",
  notifications: "Notificações",
  occurrences: "Ocorrências",
  elevators: "Elevadores",
  opsTasks: "Actividades operacionais",
  audit: "Auditoria",
};

interface Plan {
  counts: Record<string, { incoming: number; existing: number; new: number; identical: number; conflicts: number; rejected: number }>;
  conflicts: { collection: string; id: string; fields: { field: string; current: unknown; incoming: unknown }[] }[];
  conflictsTotal: number;
  rejected: { collection: string; id: string; reason: string }[];
  unknownFields: string[];
  settings: string;
  files: { inline: number; withoutContent: number };
}

const short = (v: unknown) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s === undefined ? "—" : s.length > 80 ? `${s.slice(0, 80)}…` : s;
};

export default function ImportacaoPage() {
  const refresh = useDemoStore((s) => s.refresh);
  const [local, setLocal] = useState<{ raw: string; version?: number; counts: Record<string, number> } | null>(null);
  const [source, setSource] = useState<{ name: string; data: unknown } | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [overwrite, setOverwrite] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ inserted: number; updated: number; rejected: number; skippedConflicts: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { state?: Record<string, unknown>; version?: number };
      const st = parsed.state ?? {};
      const counts = Object.fromEntries(Object.keys(LABELS).map((k) => [k, Array.isArray(st[k]) ? (st[k] as unknown[]).length : 0]));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única do armazenamento do navegador
      setLocal({ raw, version: parsed.version, counts });
    } catch {
      /* armazenamento indisponível */
    }
  }, []);

  const preview = async (name: string, data: unknown) => {
    setBusy(true);
    setPlan(null);
    setResult(null);
    setOverwrite(new Set());
    setConfirmed(false);
    try {
      const res = await fetch("/api/import/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSource({ name, data });
      setPlan(json.plan);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível analisar os dados.");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!source || !confirmed) return;
    setBusy(true);
    try {
      const res = await fetch("/api/import/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: source.data, overwrite: [...overwrite], confirm: true }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResult(json.result);
      setPlan(null);
      toast.success(`Importação concluída: ${json.result.inserted} registos inseridos.`);
      await refresh(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "A importação falhou — nada foi gravado.");
    } finally {
      setBusy(false);
    }
  };

  const totals = plan ? Object.values(plan.counts).reduce((a, c) => ({ incoming: a.incoming + c.incoming, new: a.new + c.new, identical: a.identical + c.identical, conflicts: a.conflicts + c.conflicts, rejected: a.rejected + c.rejected }), { incoming: 0, new: 0, identical: 0, conflicts: 0, rejected: 0 }) : null;

  return (
    <>
      <PageHeader eyebrow="Administração" title="Importação de dados" description="Migração dos dados guardados apenas num navegador (versões anteriores do portal) para a base de dados — com pré-visualização, relatório de conflitos e confirmação." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Dados deste navegador" description="Versões anteriores guardavam os dados no armazenamento local do navegador." action={<HardDrive className="h-4 w-4 text-graphite-400" />} />
          <CardBody className="space-y-4 text-sm">
            {local ? (
              <>
                <p className="text-graphite-600">
                  Encontrados dados locais (versão {local.version ?? "?"}): {Object.entries(local.counts)
                    .filter(([, n]) => n)
                    .map(([k, n]) => `${LABELS[k]} ${n}`)
                    .join(" · ")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => downloadBlob(`laguna-exportacao-navegador-${new Date().toISOString().slice(0, 10)}.json`, new Blob([local.raw], { type: "application/json" }))}>
                    <Download className="h-4 w-4" /> Exportar JSON
                  </Button>
                  <Button loading={busy} onClick={() => void preview("dados deste navegador", JSON.parse(local.raw))}>
                    Pré-visualizar importação
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-graphite-500">Não há dados locais neste navegador. Para migrar dados de outro computador, abra esta página nesse navegador (mesmo endereço do portal) ou importe um ficheiro exportado.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Importar ficheiro" description="Ficheiro JSON exportado de um navegador." action={<FileJson className="h-4 w-4 text-graphite-400" />} />
          <CardBody className="text-sm">
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  await preview(f.name, JSON.parse(await f.text()));
                } catch {
                  toast.error("O ficheiro não é JSON válido.");
                }
                e.target.value = "";
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Seleccionar ficheiro
            </Button>
            <p className="mt-3 text-xs text-graphite-500">A importação nunca apaga registos. Registos novos são inseridos; registos diferentes dos existentes só são substituídos se os seleccionar explicitamente.</p>
          </CardBody>
        </Card>
      </div>

      {plan && totals && (
        <Card className="mt-6" data-testid="import-plan">
          <CardHeader title={`Pré-visualização — ${source?.name}`} description={`${totals.incoming} registos analisados · ${totals.new} novos · ${totals.identical} iguais · ${totals.conflicts} conflitos · ${totals.rejected} rejeitados`} />
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-y border-graphite-100 bg-graphite-50/70 text-[11px] tracking-wider text-graphite-500 uppercase">
                  {["Colecção", "Origem", "Na base de dados", "Novos", "Iguais", "Conflitos", "Rejeitados"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-100">
                {Object.entries(plan.counts)
                  .filter(([, c]) => c.incoming)
                  .map(([k, c]) => (
                    <tr key={k}>
                      <td className="px-4 py-2 font-medium text-navy-900">{LABELS[k] ?? k}</td>
                      <td className="px-4 py-2 tabular-nums">{c.incoming}</td>
                      <td className="px-4 py-2 tabular-nums">{c.existing}</td>
                      <td className="px-4 py-2 text-emerald-700 tabular-nums">{c.new}</td>
                      <td className="px-4 py-2 tabular-nums">{c.identical}</td>
                      <td className="px-4 py-2 text-amber-700 tabular-nums">{c.conflicts}</td>
                      <td className="px-4 py-2 text-red-600 tabular-nums">{c.rejected}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <CardBody className="space-y-4 text-sm">
            <p className="text-graphite-600">
              Anexos com conteúdo a guardar: {plan.files.inline} · anexos sem conteúdo (apenas o nome — não serão inventados): {plan.files.withoutContent}
              {plan.settings === "conflito" ? " · a configuração (quotas/reservas) difere e será mantida a da base de dados" : ""}
            </p>
            {plan.conflicts.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-2 font-medium text-amber-800">
                  <AlertTriangle className="h-4 w-4" /> Relatório de conflitos ({plan.conflictsTotal}) — seleccione apenas os registos a substituir
                </p>
                <ul className="max-h-80 space-y-2 overflow-auto">
                  {plan.conflicts.map((c) => {
                    const key = `${c.collection}:${c.id}`;
                    return (
                      <li key={key} className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-xs">
                        <label className="flex items-center gap-2 font-medium text-navy-900">
                          <input
                            type="checkbox"
                            checked={overwrite.has(key)}
                            onChange={(e) =>
                              setOverwrite((s) => {
                                const n = new Set(s);
                                if (e.target.checked) n.add(key);
                                else n.delete(key);
                                return n;
                              })
                            }
                          />
                          {LABELS[c.collection] ?? c.collection} · {c.id} — substituir pelos dados importados
                        </label>
                        <ul className="mt-1 space-y-0.5 pl-6 text-graphite-600">
                          {c.fields.slice(0, 6).map((f) => (
                            <li key={f.field}>
                              <strong>{f.field}</strong>: {short(f.current)} → {short(f.incoming)}
                            </li>
                          ))}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {plan.rejected.length > 0 && (
              <details className="rounded-xl border border-red-100 bg-red-50/40 p-3 text-xs">
                <summary className="cursor-pointer font-medium text-red-700">{plan.rejected.length} registos rejeitados (não serão importados)</summary>
                <ul className="mt-2 max-h-60 space-y-0.5 overflow-auto">
                  {plan.rejected.map((r) => (
                    <li key={`${r.collection}:${r.id}`}>
                      {LABELS[r.collection] ?? r.collection} · {r.id}: {r.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} data-testid="import-confirm" />
              Confirmo a importação de {totals.new} registos novos{overwrite.size ? ` e a substituição de ${overwrite.size} registos existentes` : ""}. Fiz uma cópia de segurança da base de dados.
            </label>
            <Button disabled={!confirmed} loading={busy} onClick={() => void apply()}>
              Importar para a base de dados
            </Button>
          </CardBody>
        </Card>
      )}

      {result && (
        <Card className="mt-6">
          <CardBody className="flex items-start gap-3 text-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <p>
              Importação concluída: {result.inserted} inseridos · {result.updated} substituídos · {result.skippedConflicts} conflitos mantidos · {result.rejected} rejeitados. O registo da operação ficou guardado na base de dados.
            </p>
          </CardBody>
        </Card>
      )}
    </>
  );
}
