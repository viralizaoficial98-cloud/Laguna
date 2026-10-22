import { cn } from "@/lib/utils";

/** Indicador de progresso com rótulo e percentagem (cor por limiar). */
export function Progress({ label, value, hint, className }: { label: string; value: number; hint?: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  const tone = pct >= 90 ? "bg-emerald-600" : pct >= 75 ? "bg-navy-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="text-graphite-700">{label}</span>
        <span className="font-semibold text-navy-900 tabular-nums">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-graphite-100" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cn("h-full rounded-full transition-all duration-700", tone)} style={{ width: `${pct}%` }} />
      </div>
      {hint && <p className="mt-1 text-[11px] text-graphite-500">{hint}</p>}
    </div>
  );
}
