"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useDemoStore } from "@/store/demo-store";
import { formatDateTime } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge, occStatus } from "@/components/ui/status-badge";

export function OccurrencesWidget({ limit = 5 }: { limit?: number }) {
  const occurrences = useDemoStore((s) => s.occurrences);
  const list = [...occurrences].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  const open = occurrences.filter((o) => o.status !== "resolvida").length;
  return (
    <Card>
      <CardHeader
        title="Ocorrências recentes"
        description={`${open} por resolver`}
        action={
          <Link href="/painel/ocorrencias" className="inline-flex items-center gap-1 text-xs font-medium text-navy-700 hover:text-navy-900">
            Ver todas <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <ul className="divide-y divide-graphite-100">
        {list.map((o) => (
          <li key={o.id} className="flex items-start justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-navy-900">{o.title}</p>
              <p className="text-xs text-graphite-500">
                {o.category} · {o.location} · {formatDateTime(o.createdAt)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <StatusBadge status={occStatus(o.status)} />
              <StatusBadge status={o.priority} className="opacity-80" />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
