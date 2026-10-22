"use client";

import { AlertTriangle, ArrowUpDown, CheckCircle2, Clock, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useOperations } from "@/hooks/use-operations";
import { formatDate } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";

const AREA: Record<string, string> = { limpeza: "Limpeza", jardinagem: "Jardinagem", manutencao: "Manutenção" };

/** Alertas operacionais em tempo real (mesma fonte para Administrador e Gestor). */
export function OpsAlerts({ limit = 7 }: { limit?: number }) {
  const ops = useOperations();
  const alerts = [
    ...ops.elevators.list
      .filter((e) => e.status === "avariado" || e.status === "fora_servico")
      .map((e) => ({ key: e.id, icon: ArrowUpDown, tone: "text-red-600 bg-red-50", title: `Elevador ${e.code} ${e.status === "avariado" ? "avariado" : "fora de serviço"}`, sub: `Bloco ${e.block} · ${e.history.at(-1)?.description ?? ""}`, href: "/painel/elevadores" })),
    ...ops.occurrences.list
      .filter((o) => o.status !== "resolvida" && o.priority === "urgente")
      .map((o) => ({ key: o.id, icon: ShieldAlert, tone: "text-red-600 bg-red-50", title: `Urgente: ${o.title}`, sub: `${o.location} · ${o.assignee ?? "sem responsável"}`, href: "/painel/ocorrencias" })),
    ...ops.delayedTasks
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
      .map((t) => ({ key: t.id, icon: Clock, tone: "text-amber-700 bg-amber-50", title: `${AREA[t.area]} atrasada: ${t.title}`, sub: `Previsto ${formatDate(t.scheduledDate)} · ${t.responsible}`, href: `/painel/${t.area}` })),
  ];
  return (
    <Card>
      <CardHeader title="Alertas operacionais" description={`${alerts.length} situações a acompanhar`} action={<AlertTriangle className="h-4 w-4 text-amber-500" />} />
      {alerts.length === 0 ? (
        <p className="flex items-center gap-2 px-5 py-6 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Sem alertas operacionais.
        </p>
      ) : (
        <ul className="divide-y divide-graphite-100">
          {alerts.slice(0, limit).map((a) => (
            <li key={a.key}>
              <Link href={a.href} className="flex items-start gap-3 px-5 py-3 hover:bg-graphite-50">
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${a.tone}`}>
                  <a.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-navy-900">{a.title}</span>
                  <span className="block truncate text-xs text-graphite-500">{a.sub}</span>
                </span>
              </Link>
            </li>
          ))}
          {alerts.length > limit && <li className="px-5 py-2 text-xs text-graphite-500">+ {alerts.length - limit} alertas</li>}
        </ul>
      )}
    </Card>
  );
}
