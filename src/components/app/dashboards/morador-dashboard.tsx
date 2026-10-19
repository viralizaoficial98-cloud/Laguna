"use client";

import { AlertTriangle, ArrowRight, Bell, Building2, CalendarClock, CheckCircle2, Megaphone, PartyPopper, ScrollText, UserPlus, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import type { Session } from "@/types";
import { useDemoStore, formatApt } from "@/store/demo-store";
import { useCurrentResident } from "@/hooks/use-session";
import { formatDate, formatKz, formatQuarter, todayISO } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Welcome } from "./welcome";

export function MoradorDashboard({ session }: { session: Session }) {
  const { resident, apartment } = useCurrentResident();
  const quotas = useDemoStore((s) => s.quotas);
  const payments = useDemoStore((s) => s.payments);
  const circulars = useDemoStore((s) => s.circulars);
  const notices = useDemoStore((s) => s.notices);
  const notifications = useDemoStore((s) => s.notifications);
  const visits = useDemoStore((s) => s.visits);

  const mine = useMemo(() => quotas.filter((q) => q.apartmentId === apartment?.id).sort((a, b) => a.period.localeCompare(b.period)), [quotas, apartment]);
  const overdue = mine.filter((q) => q.status === "em_atraso");
  const debt = mine.filter((q) => q.status === "em_atraso" || q.status === "pendente").reduce((a, q) => a + q.amount, 0);
  const myPayments = useMemo(() => payments.filter((p) => p.apartmentId === apartment?.id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)), [payments, apartment]);
  const nextDue = mine.find((q) => q.status === "pendente" || q.status === "em_atraso");
  const myNotifs = notifications.filter((n) => n.roles.includes("morador")).slice(0, 4);
  const upcomingVisits = visits.filter((v) => v.residentId === resident?.id && v.status === "autorizada" && v.date >= todayISO()).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const upToDate = overdue.length === 0;

  return (
    <>
      <Welcome
        name={session.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Building2 className="h-4 w-4 text-gold-300" /> {apartment ? formatApt(apartment) : "—"}
            {apartment?.typology ? ` · ${apartment.typology}` : ""}
          </span>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Link href="/painel/minhas-quotas" className={buttonClass("gold", "lg")}>
            <Wallet className="h-4 w-4" /> Pagar quota
          </Link>
          <Link href="/painel/visitas" className={buttonClass("outline", "lg", "border-white/20 bg-white/5 text-white hover:bg-white/10")}>
            <UserPlus className="h-4 w-4" /> Registar visita
          </Link>
        </div>
      </Welcome>

      <div className="grid gap-4 md:grid-cols-3">
        <div className={`rounded-2xl border p-5 shadow-soft ${upToDate ? "border-emerald-100 bg-emerald-50/60" : "border-amber-100 bg-amber-50/60"}`}>
          <div className="flex items-center gap-3">
            {upToDate ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <AlertTriangle className="h-6 w-6 text-amber-600" />}
            <p className="font-semibold text-navy-900">{upToDate ? "Quotas em dia" : "Tem quotas em atraso"}</p>
          </div>
          <p className="mt-2 text-sm text-graphite-600">{upToDate ? "Não existem quotas trimestrais vencidas." : `${overdue.length} quota(s) trimestral(is) por regularizar.`}</p>
        </div>
        <div className="rounded-2xl border border-graphite-100 bg-white p-5 shadow-soft">
          <p className="flex items-center gap-2 text-xs text-graphite-500">
            <CalendarClock className="h-4 w-4 text-gold-600" /> Quota em aberto
          </p>
          {nextDue ? (
            <>
              <p className="mt-2 text-2xl font-semibold text-navy-900 tabular-nums">{formatKz(nextDue.amount)}</p>
              <p className="text-sm text-graphite-500">
                {formatQuarter(nextDue.period)} · data limite {formatDate(nextDue.dueDate)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-graphite-500">Sem quotas por pagar.</p>
          )}
        </div>
        <div className="rounded-2xl border border-graphite-100 bg-white p-5 shadow-soft">
          <p className="text-xs text-graphite-500">Saldo em dívida</p>
          <p className="mt-2 text-2xl font-semibold text-navy-900 tabular-nums">{formatKz(debt)}</p>
          <p className="text-sm text-graphite-500">{mine.filter((q) => q.status === "em_analise").length} comprovativo(s) em análise</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Histórico trimestral"
            description="Quotas do condomínio por trimestre"
            action={
              <Link href="/painel/minhas-quotas" className="inline-flex items-center gap-1 text-xs font-medium text-navy-700">
                Ver todas <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <ul className="divide-y divide-graphite-100">
            {[...mine]
              .reverse()
              .slice(0, 5)
              .map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-navy-900">{formatQuarter(q.period)}</p>
                    <p className="text-xs text-graphite-500">{formatQuarter(q.period, "months")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-navy-900 tabular-nums">{formatKz(q.amount)}</span>
                    <StatusBadge status={q.status} />
                  </div>
                </li>
              ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Próximas visitas" action={<Link href="/painel/visitas" className="text-xs font-medium text-navy-700">Gerir</Link>} />
          {upcomingVisits.length === 0 ? (
            <p className="px-5 py-6 text-sm text-graphite-500">Sem visitas agendadas.</p>
          ) : (
            <ul className="divide-y divide-graphite-100">
              {upcomingVisits.slice(0, 4).map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy-900">{v.kind === "grupo" ? v.eventName : v.guests[0]?.name}</p>
                    <p className="text-xs text-graphite-500">
                      {formatDate(v.date)} · {v.time}
                    </p>
                  </div>
                  {v.kind === "grupo" ? (
                    <Badge tone="violet">
                      <PartyPopper className="h-3 w-3" /> {v.guests.length}
                    </Badge>
                  ) : (
                    <Badge tone="navy">Individual</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-4">
        <Card>
          <CardHeader title="Últimos pagamentos" action={<Link href="/painel/meus-pagamentos" className="text-xs font-medium text-navy-700">Ver todos</Link>} />
          <ul className="divide-y divide-graphite-100">
            {myPayments.slice(0, 4).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-navy-900 tabular-nums">{formatKz(p.amount)}</p>
                  <p className="text-xs text-graphite-500">{formatDate(p.paidAt)}</p>
                </div>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Circulares recentes" action={<ScrollText className="h-4 w-4 text-graphite-400" />} />
          <ul className="divide-y divide-graphite-100">
            {circulars
              .filter((c) => c.status === "publicada")
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 3)
              .map((c) => (
                <li key={c.id}>
                  <Link href={`/painel/circulares/ver?id=${c.id}`} className="block px-5 py-3 hover:bg-graphite-50">
                    <p className="text-sm font-medium text-navy-900">{c.subject}</p>
                    <p className="text-xs text-graphite-500">
                      N.º {c.number} · {formatDate(c.date)}
                    </p>
                  </Link>
                </li>
              ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Comunicados" action={<Megaphone className="h-4 w-4 text-graphite-400" />} />
          <ul className="divide-y divide-graphite-100">
            {notices
              .filter((n) => n.status === "publicado")
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 3)
              .map((n) => (
                <li key={n.id}>
                  <Link href="/painel/comunicados" className="block px-5 py-3 hover:bg-graphite-50">
                    <p className="text-sm font-medium text-navy-900">{n.title}</p>
                    <p className="text-xs text-graphite-500">
                      {formatDate(n.date)} · {n.category}
                      {n.pdf ? " · PDF" : ""}
                    </p>
                  </Link>
                </li>
              ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Notificações" description="Demonstrativas" action={<Bell className="h-4 w-4 text-graphite-400" />} />
          <ul className="divide-y divide-graphite-100">
            {myNotifs.map((n) => (
              <li key={n.id} className="px-5 py-3">
                <p className="text-sm font-medium text-navy-900">{n.title}</p>
                <p className="text-xs text-graphite-500">{n.body}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Informações pessoais" action={<Link href="/painel/perfil" className="text-xs font-medium text-navy-700">Editar perfil</Link>} />
        <CardBody className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Nome", resident?.name],
            ["Email", resident?.email],
            ["Telefone", resident?.phone],
            ["Fracção", apartment ? formatApt(apartment) : undefined],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-xs text-graphite-500">{k}</p>
              <p className="font-medium text-navy-900">{v ?? "—"}</p>
            </div>
          ))}
        </CardBody>
      </Card>
    </>
  );
}
