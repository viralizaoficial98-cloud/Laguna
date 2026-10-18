"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchInput({
  value,
  onChange,
  placeholder = "Pesquisar…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-graphite-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-xl border border-graphite-200 bg-white pr-9 pl-9 text-sm placeholder:text-graphite-400 focus:border-navy-400 focus:ring-4 focus:ring-navy-100 focus:outline-none"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-graphite-400 hover:bg-graphite-100" aria-label="Limpar pesquisa">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
