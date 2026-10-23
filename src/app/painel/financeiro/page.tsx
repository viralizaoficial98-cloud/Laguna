"use client";

import Link from "next/link";
import { useSession } from "@/hooks/use-session";
import { can } from "@/config/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClass } from "@/components/ui/button";
import { FinanceDashboard } from "@/components/app/dashboards/finance-dashboard";
import { RecentPayments } from "@/components/app/widgets/recent-payments";

export default function FinanceiroPage() {
  const session = useSession();
  const full = can(session?.role, "finance.view");
  return (
    <>
      <PageHeader
        eyebrow={full ? "Financeiro" : "Consulta limitada"}
        title={full ? "Dashboard financeiro" : "Resumo financeiro"}
        description={full ? "Receitas, cobrança, dívidas, despesas, reservas e saldo do condomínio — quotas trimestrais por tipologia (T2 e Duplex)." : "Indicadores agregados de cobrança para acompanhamento operacional."}
        actions={
          <Link href="/painel/relatorios" className={buttonClass("primary")}>
            {full ? "Relatório financeiro (PDF)" : "Resumo (PDF)"}
          </Link>
        }
      />
      <FinanceDashboard mode={full ? "full" : "limited"} />
      {full && (
        <div className="mt-6">
          <RecentPayments />
        </div>
      )}
    </>
  );
}
