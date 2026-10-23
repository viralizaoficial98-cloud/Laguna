"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Reservation } from "@/types";
import { BLOCKING_RESERVATION } from "@/store/demo-store";
import { cn, todayISO } from "@/lib/utils";

export type DayState = "disponivel" | "pendente" | "reservado" | "passado";

const WEEK = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Estado de uma data para um salão (cada salão tem calendário independente). */
export function dayState(reservations: Reservation[], hallId: string, date: string): { state: DayState; holder?: Reservation } {
  if (date <= todayISO()) return { state: "passado" };
  const holder = reservations.find((r) => r.hallId === hallId && r.date === date && BLOCKING_RESERVATION.includes(r.status));
  if (!holder) return { state: "disponivel" };
  return { state: holder.status === "confirmada" ? "reservado" : "pendente", holder };
}

const STYLE: Record<DayState, string> = {
  disponivel: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  pendente: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
  reservado: "border-navy-200 bg-navy-100 text-navy-800",
  passado: "border-transparent bg-graphite-50 text-graphite-300",
};
export const DAY_LABEL: Record<DayState, string> = { disponivel: "Disponível", pendente: "Pendente", reservado: "Reservado", passado: "Indisponível" };

export function HallCalendar({ reservations, hallId, selected, onSelect }: { reservations: Reservation[]; hallId: string; selected?: string; onSelect?: (date: string) => void }) {
  const t = new Date(`${todayISO()}T12:00:00`);
  const [ym, setYm] = useState({ y: t.getFullYear(), m: t.getMonth() });
  const first = new Date(ym.y, ym.m, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const move = (n: number) => setYm(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));
  const monthLabel = first.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });

  return (
    <div data-testid="hall-calendar">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} className="rounded-lg p-2 hover:bg-graphite-100" aria-label="Mês anterior">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-navy-900 capitalize" data-testid="calendar-month">
          {monthLabel}
        </p>
        <button type="button" onClick={() => move(1)} className="rounded-lg p-2 hover:bg-graphite-100" aria-label="Mês seguinte">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold tracking-wider text-graphite-400 uppercase">
        {WEEK.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: days }).map((_, i) => {
          const date = iso(ym.y, ym.m, i + 1);
          const { state } = dayState(reservations, hallId, date);
          return (
            <button
              key={date}
              type="button"
              data-date={date}
              data-state={state}
              disabled={state === "passado" || !onSelect}
              onClick={() => onSelect?.(date)}
              title={DAY_LABEL[state]}
              className={cn("aspect-square rounded-lg border text-xs font-medium transition sm:text-sm", STYLE[state], selected === date && "ring-2 ring-gold-500 ring-offset-1", !onSelect && "cursor-default")}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-graphite-600">
        {(["disponivel", "pendente", "reservado"] as DayState[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cn("h-3 w-3 rounded border", STYLE[s])} /> {DAY_LABEL[s]}
          </span>
        ))}
      </div>
    </div>
  );
}
