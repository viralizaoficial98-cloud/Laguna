"use client";

import { AlertTriangle, Building2, CheckCircle2, CircleDollarSign, DoorOpen, Hourglass, Clock, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import type { Session } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { useFinance } from "@/hooks/use-finance";
import { formatKz } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { buttonClass } from "@/components/ui/button";
import { Donut, GroupedBars } from "@/components/charts/charts";
import { PendingPayments } from "@/components/app/widgets/pending-payments";
import { OccurrencesWidget } from "@/components/app/widgets/occurrences-widget";
import { Welcome } from "./welcome";

export function AdminGeralDashboard({ session }: { session: Session }) {
  const apartments = useDemoStore((s) => s.apartments);
  const residents = useDemoStore((s) => s.residents);
  const f = useFinance();
  const occ = useMemo(
    () => ({
      ocupado: apartments.filter((a) => a.status === "ocupado").length,
      disponivel: apartments.filter((a) => a.status === "disponivel").length,
      manutencao: apartments.filter((a) => a.status === "manutencao").length,
    }),
    [apartments],
  );
  const blocks = useMemo(() => {
    const b = Array.from(new Set(apartments.map((a) => a.block))).sort();
    return b.map((block) => {
      const list = apartments.filter((a) => a.block === block);
      return { label: `Bloco ${block}`, ocupados: list.filter((a) => a.status === "ocupado").length, disponiveis: list.filter((a) => a.status !== "ocupado").length };
    });
  }, [apartments]);

  return (
    <>
      <Welcome name={session.name} subtitle="Visão geral do Residencial Laguna — todos os módulos.">
        <div className="flex flex-wrap gap-2">
          <Link href="/painel/relatorios" className={buttonClass("gold")}>
            Relatórios
          </Link>
          <Link href="/painel/circulares/editor" className={buttonClass("outline", "md", "border-white/20 bg-white/5 text-white hover:bg-white/10")}>
            Nova circular
          </Link>
        </div>
      </Welcome>

      <div className="mb-3 flex justify-end">
        <DemoDataNote />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard index={0} label="Total de apartamentos" value={apartments.length} icon={Building2} />
        <StatCard index={1} label="Total de moradores" value={residents.length} icon={Users} tone="info" hint={`${residents.filter((r) => r.status === "activo").length} activos`} />
        <StatCard index={2} label="Apartamentos ocupados" value={occ.ocupado} icon={DoorOpen} tone="navy" hint={`${Math.round((occ.ocupado / apartments.length) * 100)}% de ocupação`} />
        <StatCard index={3} label="Apartamentos disponíveis" value={occ.disponivel} icon={Building2} tone="success" hint={`${occ.manutencao} em manutenção`} />
        <StatCard index={4} highlight label="Receita mensal" value={formatKz(f.monthRevenue)} icon={CircleDollarSign} hint="Outubro 2026" />
        <StatCard index={5} label="Quotas pagas" value={f.paidCount} icon={CheckCircle2} tone="success" hint="até ao mês corrente" />
        <StatCard index={6} label="Quotas pendentes" value={f.pendingCount} icon={Clock} tone="info" hint={formatKz(f.pending)} />
        <StatCard index={7} label="Valores em atraso" value={formatKz(f.overdue)} icon={AlertTriangle} tone="warning" hint={`${f.overdueCount} quotas`} />
        <StatCard index={8} label="Aguardam aprovação" value={f.analysisCount} icon={Hourglass} tone="gold" hint={formatKz(f.analysis)} />
        <StatCard index={9} label="A vencer" value={formatKz(f.upcoming)} icon={Wallet} tone="navy" hint="Novembro 2026" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Receitas mensais" description="Emitido vs. recebido (Kz)" />
          <CardBody>
            <GroupedBars data={f.monthly} series={[{ key: "emitido", label: "Emitido" }, { key: "recebido", label: "Recebido" }]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Estado das quotas" description="Distribuição por estado" />
          <CardBody>
            <Donut useStatusColors data={f.statusCounts.map((s) => ({ key: s.status, value: s.count }))} centerValue={`${Math.round(f.collectionRate * 100)}%`} centerLabel="cobrança" />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Ocupação" description="Estado dos apartamentos" />
          <CardBody>
            <Donut
              data={[
                { key: "ocupado", label: "Ocupados", value: occ.ocupado },
                { key: "disponivel", label: "Disponíveis", value: occ.disponivel },
                { key: "manutencao", label: "Em manutenção", value: occ.manutencao },
              ]}
              centerValue={String(apartments.length)}
              centerLabel="apartamentos"
            />
          </CardBody>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Ocupação por bloco" description="Blocos de demonstração" />
          <CardBody>
            <GroupedBars data={blocks} currency={false} height={220} series={[{ key: "ocupados", label: "Ocupados" }, { key: "disponiveis", label: "Livres / manutenção" }]} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <PendingPayments />
        <OccurrencesWidget />
      </div>
    </>
  );
}
