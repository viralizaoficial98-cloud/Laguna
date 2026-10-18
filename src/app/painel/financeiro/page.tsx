"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClass } from "@/components/ui/button";
import { FinanceOverview } from "@/components/app/dashboards/finance-overview";

export default function FinanceiroPage() {
  return (
    <>
      <PageHeader
        eyebrow="Financeiro"
        title="Visão financeira"
        description="Receitas, quotas e pagamentos em Kwanza (Kz). Valores fictícios de demonstração."
        actions={
          <Link href="/painel/pagamentos" className={buttonClass("primary")}>
            Aprovar pagamentos
          </Link>
        }
      />
      <FinanceOverview />
    </>
  );
}
