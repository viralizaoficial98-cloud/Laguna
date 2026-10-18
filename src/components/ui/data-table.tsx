"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Esconde a coluna na vista de cartões (telemóvel). */
  hideOnMobile?: boolean;
  /** Coluna principal do cartão móvel (título). */
  primary?: boolean;
  align?: "left" | "right" | "center";
}

/**
 * Tabela responsiva: em ecrãs ≥ md apresenta tabela; em telemóvel converte
 * cada linha num cartão legível. Inclui paginação local.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  pageSize = 10,
  onRowClick,
  emptyTitle = "Sem resultados",
  emptyDescription = "Ajuste a pesquisa ou os filtros aplicados.",
  dense,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  dense?: boolean;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * pageSize, current * pageSize + pageSize);
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const actions = columns.find((c) => c.key === "actions");

  if (rows.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  const align = (a?: Column<T>["align"]) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");

  return (
    <div>
      {/* Desktop / tablet */}
      <div className="scrollbar-thin hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-graphite-100 bg-graphite-50/70">
              {columns.map((c) => (
                <th key={c.key} className={cn("px-4 py-3 text-[11px] font-semibold tracking-wider whitespace-nowrap text-graphite-500 uppercase", align(c.align), c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-graphite-100">
            {visible.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn("transition-colors hover:bg-navy-50/40", onRowClick && "cursor-pointer")}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 text-graphite-700", dense ? "py-2" : "py-3", align(c.align), c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Telemóvel */}
      <ul className="divide-y divide-graphite-100 md:hidden">
        {visible.map((row) => (
          <li key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined} className={cn("px-4 py-3.5", onRowClick && "cursor-pointer active:bg-navy-50/50")}>
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0 font-medium text-navy-900">{primary.cell(row)}</div>
              {actions && <div onClick={(e) => e.stopPropagation()}>{actions.cell(row)}</div>}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {columns
                .filter((c) => c !== primary && c !== actions && !c.hideOnMobile)
                .map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-[10px] tracking-wider text-graphite-400 uppercase">{c.header}</dt>
                    <dd className="truncate text-[13px] text-graphite-700">{c.cell(row)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-graphite-100 px-4 py-3 text-xs text-graphite-500">
          <span>
            {current * pageSize + 1}–{Math.min(rows.length, (current + 1) * pageSize)} de {rows.length}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(current - 1)} disabled={current === 0} className="rounded-lg p-1.5 hover:bg-graphite-100 disabled:opacity-40" aria-label="Página anterior">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 font-medium text-navy-900">
              {current + 1} / {pages}
            </span>
            <button onClick={() => setPage(current + 1)} disabled={current >= pages - 1} className="rounded-lg p-1.5 hover:bg-graphite-100 disabled:opacity-40" aria-label="Página seguinte">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
