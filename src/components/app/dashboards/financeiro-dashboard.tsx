"use client";

import { ArrowRight, Banknote, ClipboardList, Coins, FileText, LogOut, PartyPopper } from "lucide-react";
import Link from "next/link";
import type { Session } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { formatDate, formatKz } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { PendingPayments } from "@/components/app/widgets/pending-payments";
import { Welcome } from "./welcome";
import { FinanceDashboard } from "./finance-dashboard";

/** Dashboard do Gestor Financeiro do Condomínio (Saraiva). */
export function FinanceiroDashboard({ session }: { session: Session }) {
  const reservations = useDemoStore((s) => s.reservations);
  const moveOuts = useDemoStore((s) => s.moveOuts);
  const resValidation = reservations.filter((r) => r.status === "em_validacao");
  const moActive = moveOuts.filter((m) => !["concluida", "cancelada"].includes(m.status));

  return (
    <>
      <Welcome name={session.name} subtitle="Gestor Financeiro do Condomínio · receitas, cobranças, despesas, contas correntes e relatórios">
        <div className="flex flex-wrap gap-2">
          <Link href="/painel/pagamentos" className={buttonClass("gold")}>
            <Banknote className="h-4 w-4" /> Validar comprovativos
          </Link>
          <Link href="/painel/relatorios" className={buttonClass("outline", "md", "border-white/20 bg-white/5 text-white hover:bg-white/10")}>
            <FileText className="h-4 w-4" /> Relatórios PDF
          </Link>
        </div>
      </Welcome>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "/painel/conta-corrente", label: "Contas correntes", icon: ClipboardList },
          { href: "/painel/despesas", label: "Despesas", icon: Coins },
          { href: "/painel/reservas", label: `Reservas (${resValidation.length} por validar)`, icon: PartyPopper },
          { href: "/painel/desocupacao", label: `Desocupações (${moActive.length})`, icon: LogOut },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center gap-3 rounded-2xl border border-graphite-100 bg-white p-4 text-sm font-medium text-navy-900 shadow-soft hover:border-navy-200">
            <l.icon className="h-5 w-5 text-gold-600" /> {l.label}
          </Link>
        ))}
      </div>

      <FinanceDashboard mode="full" />

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <PendingPayments />
        </div>
        <Card>
          <CardHeader title="Pagamentos de reservas" description={`${resValidation.length} em validação`} action={<Link href="/painel/reservas" className="inline-flex items-center gap-1 text-xs font-medium text-navy-700">Abrir <ArrowRight className="h-3.5 w-3.5" /></Link>} />
          <ul className="divide-y divide-graphite-100">
            {resValidation.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <span className="font-medium text-navy-900">{r.eventName}</span>
                  <span className="block text-xs text-graphite-500">{formatDate(r.date)} · {formatKz(r.fee)}</span>
                </span>
                <StatusBadge status={r.status} />
              </li>
            ))}
            {!resValidation.length && <li className="px-5 py-6 text-sm text-graphite-400">Sem pagamentos de reservas por validar.</li>}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Desocupações em curso" description="Verificação financeira" action={<Link href="/painel/desocupacao" className="inline-flex items-center gap-1 text-xs font-medium text-navy-700">Abrir <ArrowRight className="h-3.5 w-3.5" /></Link>} />
          <ul className="divide-y divide-graphite-100">
            {moActive.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <span className="font-medium text-navy-900">{m.reference}</span>
                  <span className="block text-xs text-graphite-500">{m.residentName} · Bloco {m.block} · {m.number}</span>
                </span>
                <StatusBadge status={m.status} />
              </li>
            ))}
            {!moActive.length && <li className="px-5 py-6 text-sm text-graphite-400">Sem processos em curso.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
