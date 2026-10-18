import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Linha única de filtros por cima das tabelas/gráficos. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-2.5 border-b border-graphite-100 p-4 sm:flex-row sm:flex-wrap sm:items-center", className)}>{children}</div>;
}
