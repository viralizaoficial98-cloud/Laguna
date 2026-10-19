"use client";

import { Building2, FileStack, Hourglass, Megaphone, ScrollText, ShieldAlert, Users, BarChart3 } from "lucide-react";
import Link from "next/link";
import type { Session } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { useFinance } from "@/hooks/use-finance";
import { formatDate } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { PendingPayments } from "@/components/app/widgets/pending-payments";
import { OccurrencesWidget } from "@/components/app/widgets/occurrences-widget";
import { Welcome } from "./welcome";

const shortcuts = [
  { href: "/painel/apartamentos", label: "Blocos e apartamentos", icon: Building2 },
  { href: "/painel/moradores", label: "Moradores", icon: Users },
  { href: "/painel/quotas", label: "Quotas trimestrais", icon: FileStack },
  { href: "/painel/circulares/editor", label: "Emitir circular", icon: ScrollText },
  { href: "/painel/comunicados", label: "Comunicados (PDF)", icon: Megaphone },
  { href: "/painel/portaria", label: "Visitas", icon: BarChart3 },
];

export function AdministradorDashboard({ session }: { session: Session }) {
  const apartments = useDemoStore((s) => s.apartments);
  const residents = useDemoStore((s) => s.residents);
  const circulars = useDemoStore((s) => s.circulars);
  const occurrences = useDemoStore((s) => s.occurrences);
  const documents = useDemoStore((s) => s.documents);
  const f = useFinance();

  return (
    <>
      <Welcome name={session.name} subtitle="Administrador do Condomínio · Residencial Laguna" image="/images/laguna/fachadas/entrada-principal.webp" />
      <div className="mb-3 flex justify-end">
        <DemoDataNote />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} label="Fracções activas" value={apartments.filter((a) => a.active).length} icon={Building2} hint={`${apartments.filter((a) => a.active && a.status === "ocupado").length} ocupadas · 10 blocos`} />
        <StatCard index={1} label="Moradores activos" value={residents.filter((r) => r.status === "activo").length} icon={Users} tone="info" />
        <StatCard index={2} label="Comprovativos por validar" value={f.analysisCount} icon={Hourglass} tone="gold" hint="quotas trimestrais" />
        <StatCard index={3} label="Ocorrências abertas" value={occurrences.filter((o) => o.status !== "resolvida").length} icon={ShieldAlert} tone="warning" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {shortcuts.map((s) => (
          <Link key={s.href} href={s.href} className="group flex flex-col items-center gap-3 rounded-2xl border border-graphite-100 bg-white p-5 text-center shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-navy-900 hover:bg-navy-900 hover:shadow-lift">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-700 transition-colors group-hover:bg-white/10 group-hover:text-gold-300">
              <s.icon className="h-5 w-5" />
            </span>
            <span className="text-xs font-medium text-navy-900 transition-colors group-hover:text-white">{s.label}</span>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <PendingPayments />
        <OccurrencesWidget />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Circulares" description="Últimas circulares e rascunhos" action={<Link href="/painel/circulares" className="text-xs font-medium text-navy-700">Gerir</Link>} />
          <ul className="divide-y divide-graphite-100">
            {[...circulars].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4).map((c) => (
              <li key={c.id}>
                <Link href={`/painel/circulares/ver?id=${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-graphite-50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy-900">{c.subject}</p>
                    <p className="text-xs text-graphite-500">N.º {c.number} · {formatDate(c.date)}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Documentos recentes" action={<Link href="/painel/documentos" className="text-xs font-medium text-navy-700">Ver todos</Link>} />
          <ul className="divide-y divide-graphite-100">
            {[...documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4).map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-50 text-[10px] font-bold text-navy-700">{d.fileType}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-navy-900">{d.title}</p>
                  <p className="text-xs text-graphite-500">{formatDate(d.updatedAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
