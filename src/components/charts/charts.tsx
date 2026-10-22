"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatKzCompact } from "@/lib/utils";
import { statusLabel } from "@/components/ui/status-badge";
import { axisProps, CHART_COLORS, ChartTooltip, gridProps, Legend, STATUS_COLORS } from "./chart-kit";

interface SeriesDef {
  key: string;
  label: string;
}

/** Barras agrupadas (ex.: emitido vs recebido por mês). */
export function GroupedBars({ data, series, xKey = "label", height = 280, currency = true }: { data: Record<string, unknown>[]; series: SeriesDef[]; xKey?: string; height?: number; currency?: boolean }) {
  return (
    <div>
      <Legend items={series.map((s, i) => ({ label: s.label, color: CHART_COLORS[i] }))} />
      <div style={{ height }} className="mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} width={56} tickFormatter={(v) => (currency ? formatKzCompact(v) : String(v))} />
            <Tooltip cursor={{ fill: "rgba(46,90,156,0.06)" }} content={<ChartTooltip currency={currency} />} />
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={CHART_COLORS[i]} radius={[4, 4, 0, 0]} maxBarSize={28} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Área com gradiente para tendências ao longo do tempo. */
export function TrendArea({ data, dataKey, label, xKey = "label", height = 240, currency = true, color = CHART_COLORS[0] }: { data: Record<string, unknown>[]; dataKey: string; label: string; xKey?: string; height?: number; currency?: boolean; color?: string }) {
  const id = `grad-${dataKey}`;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={xKey} {...axisProps} />
          <YAxis {...axisProps} width={56} allowDecimals={false} tickFormatter={(v) => (currency ? formatKzCompact(v) : String(v))} />
          <Tooltip cursor={{ stroke: "#b0b7c3", strokeDasharray: "3 3" }} content={<ChartTooltip currency={currency} />} />
          <Area type="monotone" dataKey={dataKey} name={label} stroke={color} strokeWidth={2} fill={`url(#${id})`} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut com legenda e valores (identidade nunca só pela cor). */
export function Donut({
  data,
  height = 180,
  centerLabel,
  centerValue,
  useStatusColors,
  valueFormat,
}: {
  data: { key: string; label?: string; value: number }[];
  height?: number;
  centerLabel?: string;
  centerValue?: string;
  useStatusColors?: boolean;
  valueFormat?: (v: number) => string;
}) {
  const color = (k: string, i: number) => (useStatusColors ? STATUS_COLORS[k] ?? CHART_COLORS[i] : CHART_COLORS[i % CHART_COLORS.length]);
  const items = data.filter((d) => d.value > 0);
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative shrink-0" style={{ height, width: height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={items} dataKey="value" nameKey="label" innerRadius="68%" outerRadius="100%" paddingAngle={2} stroke="#fff" strokeWidth={2} cornerRadius={4}>
              {items.map((d) => (
                <Cell key={d.key} fill={color(d.key, data.indexOf(d))} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip currency={false} />} />
          </PieChart>
        </ResponsiveContainer>
        {centerValue && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold text-navy-900 tabular-nums">{centerValue}</span>
            {centerLabel && <span className="text-[11px] text-graphite-500">{centerLabel}</span>}
          </div>
        )}
      </div>
      <ul className="grid w-full grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {data.map((d, i) => (
          <li key={d.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-graphite-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color(d.key, i) }} />
              {d.label ?? statusLabel(d.key)}
            </span>
            <span className="font-semibold text-navy-900 tabular-nums">{valueFormat ? valueFormat(d.value) : d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras horizontais simples para rankings/categorias. */
export function HBars({ data, height = 220, currency = false }: { data: { label: string; value: number }[]; height?: number; currency?: boolean }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid {...gridProps} horizontal={false} vertical />
          <XAxis type="number" {...axisProps} allowDecimals={false} tickFormatter={(v) => (currency ? formatKzCompact(v) : String(v))} />
          <YAxis type="category" dataKey="label" {...axisProps} width={96} />
          <Tooltip cursor={{ fill: "rgba(46,90,156,0.06)" }} content={<ChartTooltip currency={currency} />} />
          <Bar dataKey="value" name="Total" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Linhas múltiplas (ex.: evolução de receitas e despesas). Um único eixo Y. */
export function MultiLine({ data, series, xKey = "label", height = 280, currency = true, percent = false }: { data: Record<string, unknown>[]; series: SeriesDef[]; xKey?: string; height?: number; currency?: boolean; percent?: boolean }) {
  return (
    <div>
      <Legend items={series.map((s, i) => ({ label: s.label, color: CHART_COLORS[i] }))} />
      <div style={{ height }} className="mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} width={56} tickFormatter={(v) => (percent ? `${v}%` : currency ? formatKzCompact(v) : String(v))} />
            <Tooltip cursor={{ stroke: "#b0b7c3", strokeDasharray: "3 3" }} content={<ChartTooltip currency={currency && !percent} />} />
            {series.map((s, i) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={CHART_COLORS[i]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: CHART_COLORS[i] }} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Barras verticais de uma série, com cor opcional por valor (ex.: taxa de pagamento por bloco). */
export function SimpleBars({ data, dataKey, label, xKey = "label", height = 240, currency = false, percent = false, colorFor }: { data: Record<string, unknown>[]; dataKey: string; label: string; xKey?: string; height?: number; currency?: boolean; percent?: boolean; colorFor?: (v: number) => string }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={xKey} {...axisProps} />
          <YAxis {...axisProps} width={56} domain={percent ? [0, 100] : undefined} tickFormatter={(v) => (percent ? `${v}%` : currency ? formatKzCompact(v) : String(v))} />
          <Tooltip cursor={{ fill: "rgba(46,90,156,0.06)" }} content={<ChartTooltip currency={currency} />} />
          <Bar dataKey={dataKey} name={label} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={30}>
            {colorFor && data.map((d, i) => <Cell key={i} fill={colorFor(Number(d[dataKey]))} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
