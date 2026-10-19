"use client";

import type { ReactNode } from "react";
import { formatKz } from "@/lib/utils";

/** Paleta categórica validada (ordem fixa, nunca cíclica). */
export const CHART_COLORS = ["#2e5a9c", "#b8873a", "#0e9c8e", "#9a5bc0"];

/** Cores de estado (reservadas) — acompanhadas sempre por texto. */
export const STATUS_COLORS: Record<string, string> = {
  pago: "#15803d",
  aprovado: "#15803d",
  em_analise: "#0284c7",
  pendente: "#94a3b8",
  em_atraso: "#d97706",
  rejeitado: "#dc2626",
};

export const axisProps = {
  tick: { fill: "#677083", fontSize: 11 },
  axisLine: false,
  tickLine: false,
} as const;

export const gridProps = { stroke: "#e8eaee", strokeDasharray: "0", vertical: false } as const;

interface TooltipPayload {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

export function ChartTooltip({
  active,
  payload,
  label,
  currency = true,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: ReactNode;
  currency?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-xl border border-graphite-100 bg-white/95 px-3 py-2.5 text-xs shadow-lift backdrop-blur">
      {label !== undefined && <p className="mb-1.5 font-semibold text-navy-900">{label}</p>}
      <ul className="space-y-1">
        {payload.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-graphite-600">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-semibold text-navy-900 tabular-nums">{currency && typeof p.value === "number" ? formatKz(p.value) : p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; value?: ReactNode }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-graphite-600">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
          {i.value !== undefined && <span className="font-semibold text-navy-900">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}
