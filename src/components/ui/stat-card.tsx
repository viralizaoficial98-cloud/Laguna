"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  navy: "bg-navy-50 text-navy-700",
  gold: "bg-gold-50 text-gold-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-sky-50 text-sky-700",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "navy",
  index = 0,
  highlight,
  trend,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  hint?: ReactNode;
  tone?: keyof typeof tones;
  index?: number;
  highlight?: boolean;
  /** Variação percentual face ao período anterior. */
  trend?: { value: number; goodWhenUp?: boolean } | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift",
        highlight ? "border-navy-800 bg-gradient-to-br from-navy-900 to-navy-800 text-white" : "border-graphite-100 bg-white",
      )}
    >
      {highlight && <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gold-500/20 blur-2xl" />}
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-xs font-medium", highlight ? "text-navy-100" : "text-graphite-500")}>{label}</p>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110", highlight ? "bg-white/10 text-gold-300" : tones[tone])}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className={cn("mt-3 text-2xl font-semibold tracking-tight tabular-nums", highlight ? "text-white" : "text-navy-900")}>{value}</p>
      {(hint || trend) && (
        <p className={cn("mt-1 flex flex-wrap items-center gap-1.5 text-xs", highlight ? "text-navy-200" : "text-graphite-500")}>
          {trend && Number.isFinite(trend.value) && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                trend.value === 0 ? "bg-graphite-100 text-graphite-600" : (trend.value > 0) === (trend.goodWhenUp ?? true) ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
              )}
            >
              {trend.value > 0 ? "▲" : trend.value < 0 ? "▼" : "■"} {Math.abs(trend.value).toFixed(1)}%
            </span>
          )}
          {hint}
        </p>
      )}
    </motion.div>
  );
}
