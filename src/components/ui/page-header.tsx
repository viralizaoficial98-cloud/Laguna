import type { ReactNode } from "react";

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[11px] font-semibold tracking-[0.2em] text-gold-600 uppercase">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-semibold text-navy-900 sm:text-[2.15rem]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-graphite-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
