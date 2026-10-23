"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useDemoStore } from "@/store/demo-store";
import { formatDate } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

/** Desocupações em curso — vistorias (verificação operacional) pendentes. */
export function MoveOutQueue() {
  const moveOuts = useDemoStore((s) => s.moveOuts);
  const active = moveOuts.filter((m) => !["concluida", "cancelada"].includes(m.status));
  const pendingInspections = active.filter((m) => m.operational.status !== "concluida").length;
  return (
    <Card>
      <CardHeader
        title="Desocupações e vistorias"
        description={`${active.length} processos em curso · ${pendingInspections} vistorias pendentes`}
        action={
          <Link href="/painel/desocupacao" className="inline-flex items-center gap-1 text-xs font-medium text-navy-700">
            Abrir <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <ul className="divide-y divide-graphite-100">
        {active.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <span>
              <span className="font-medium text-navy-900">
                {m.reference} · Bloco {m.block} · {m.number}
              </span>
              <span className="block text-xs text-graphite-500">
                {m.residentName} · saída prevista {formatDate(m.plannedDate)} · vistoria {m.operational.status === "concluida" ? "concluída" : "pendente"}
              </span>
            </span>
            <StatusBadge status={m.status} />
          </li>
        ))}
        {!active.length && <li className="px-5 py-6 text-sm text-graphite-400">Sem processos em curso.</li>}
      </ul>
    </Card>
  );
}
