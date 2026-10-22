"use client";

import { CalendarRange } from "lucide-react";
import { BLOCKS } from "@/data/management";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export interface PeriodValue {
  year: number;
  quarter: number; // 0 = ano completo
  block?: string;
}

/** Selector de período (ano + trimestre) e, opcionalmente, bloco. */
export function PeriodFilter({ value, onChange, years, withBlock, className }: { value: PeriodValue; onChange: (v: PeriodValue) => void; years: number[]; withBlock?: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 rounded-2xl border border-graphite-100 bg-white p-2 shadow-soft", className)}>
      <CalendarRange className="ml-2 h-4 w-4 text-gold-600" />
      <Select value={value.year} onChange={(e) => onChange({ ...value, year: Number(e.target.value) })} className="h-9 w-24" aria-label="Ano">
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
      <Select value={value.quarter} onChange={(e) => onChange({ ...value, quarter: Number(e.target.value) })} className="h-9 w-40" aria-label="Trimestre">
        <option value={0}>Ano completo</option>
        {[1, 2, 3, 4].map((q) => (
          <option key={q} value={q}>
            {q}.º Trimestre
          </option>
        ))}
      </Select>
      {withBlock && (
        <Select value={value.block ?? ""} onChange={(e) => onChange({ ...value, block: e.target.value || undefined })} className="h-9 w-36" aria-label="Bloco">
          <option value="">Todos os blocos</option>
          {BLOCKS.map((b) => (
            <option key={b} value={b}>
              Bloco {b}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}

/** Intervalo de datas de um período (para filtrar dados operacionais). */
export function periodRange(v: PeriodValue) {
  if (!v.quarter) return { from: `${v.year}-01-01`, to: `${v.year}-12-31` };
  const m1 = (v.quarter - 1) * 3 + 1;
  const last = new Date(v.year, m1 + 2, 0).getDate();
  return { from: `${v.year}-${String(m1).padStart(2, "0")}-01`, to: `${v.year}-${String(m1 + 2).padStart(2, "0")}-${last}` };
}

export function periodLabel(v: PeriodValue) {
  return v.quarter ? `${v.quarter}.º Trimestre ${v.year}` : `Ano ${v.year}`;
}

/** Período anterior equivalente (para indicadores de tendência). */
export function previousPeriod(v: PeriodValue): PeriodValue {
  if (!v.quarter) return { ...v, year: v.year - 1 };
  return v.quarter === 1 ? { ...v, year: v.year - 1, quarter: 4 } : { ...v, quarter: v.quarter - 1 };
}
