import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "navy" | "gold" | "success" | "warning" | "danger" | "info" | "violet";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-graphite-100 text-graphite-700 ring-graphite-200",
  navy: "bg-navy-50 text-navy-800 ring-navy-100",
  gold: "bg-gold-50 text-gold-800 ring-gold-200",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-800 ring-red-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  violet: "bg-violet-50 text-violet-800 ring-violet-200",
};

const dots: Record<BadgeTone, string> = {
  neutral: "bg-graphite-400",
  navy: "bg-navy-500",
  gold: "bg-gold-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-sky-500",
  violet: "bg-violet-500",
};

export function Badge({ tone = "neutral", children, dot, className }: { tone?: BadgeTone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset", tones[tone], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dots[tone])} />}
      {children}
    </span>
  );
}
