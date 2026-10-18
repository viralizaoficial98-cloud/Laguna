"use client";

import { motion } from "framer-motion";
import { useId } from "react";
import { cn } from "@/lib/utils";

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div role="tablist" className={cn("scrollbar-thin flex gap-1 overflow-x-auto rounded-xl bg-graphite-100/80 p-1", className)}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn("relative rounded-lg px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors", active ? "text-navy-900" : "text-graphite-500 hover:text-navy-800")}
          >
            {active && <motion.span layoutId={`tab-${id}`} className="absolute inset-0 rounded-lg bg-white shadow-soft" transition={{ type: "spring", bounce: 0.18, duration: 0.45 }} />}
            <span className="relative flex items-center gap-1.5">
              {t.label}
              {t.count !== undefined && <span className={cn("rounded-full px-1.5 text-[10px]", active ? "bg-navy-900 text-white" : "bg-graphite-200 text-graphite-600")}>{t.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
