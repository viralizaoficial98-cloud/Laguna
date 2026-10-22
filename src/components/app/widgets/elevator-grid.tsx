"use client";

import { ArrowUpDown } from "lucide-react";
import type { Elevator, ElevatorStatus } from "@/types";
import { cn, formatDate } from "@/lib/utils";

export const ELEVATOR_STATUS: Record<ElevatorStatus, { label: string; card: string; dot: string; text: string }> = {
  operacional: { label: "Operacional", card: "border-emerald-200 bg-emerald-50/60", dot: "bg-emerald-500", text: "text-emerald-800" },
  avariado: { label: "Avariado", card: "border-red-200 bg-red-50/70", dot: "bg-red-500 animate-pulse", text: "text-red-800" },
  em_manutencao: { label: "Em manutenção", card: "border-amber-200 bg-amber-50/70", dot: "bg-amber-500", text: "text-amber-800" },
  fora_servico: { label: "Fora de serviço", card: "border-graphite-300 bg-graphite-100", dot: "bg-graphite-500", text: "text-graphite-700" },
};

/** Grelha visual do estado dos elevadores (cor + texto, nunca só cor). */
export function ElevatorGrid({ elevators, onSelect, highlightBlock }: { elevators: Elevator[]; onSelect?: (e: Elevator) => void; highlightBlock?: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {elevators.map((e) => {
        const st = ELEVATOR_STATUS[e.status];
        return (
          <button
            key={e.id}
            type="button"
            onClick={onSelect ? () => onSelect(e) : undefined}
            className={cn("rounded-2xl border p-4 text-left transition", st.card, onSelect && "hover:-translate-y-0.5 hover:shadow-soft", !onSelect && "cursor-default", highlightBlock === e.block && "ring-2 ring-gold-400")}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-graphite-500 uppercase">Bloco {e.block}</span>
              <ArrowUpDown className="h-4 w-4 text-graphite-400" />
            </div>
            <p className="mt-1 font-semibold text-navy-900">{e.code}</p>
            <p className={cn("mt-2 flex items-center gap-1.5 text-xs font-medium", st.text)}>
              <span className={cn("h-2 w-2 rounded-full", st.dot)} /> {st.label}
            </p>
            {e.nextMaintenance && <p className="mt-1 text-[11px] text-graphite-500">Próx. manutenção {formatDate(e.nextMaintenance, { day: "2-digit", month: "2-digit" })}</p>}
          </button>
        );
      })}
    </div>
  );
}
