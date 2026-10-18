"use client";

import { useSession } from "@/hooks/use-session";
import { AdminGeralDashboard } from "@/components/app/dashboards/admin-geral-dashboard";
import { AdministradorDashboard } from "@/components/app/dashboards/administrador-dashboard";
import { PorteiroDashboard } from "@/components/app/dashboards/porteiro-dashboard";
import { MoradorDashboard } from "@/components/app/dashboards/morador-dashboard";
import { FinanceOverview } from "@/components/app/dashboards/finance-overview";
import { Welcome } from "@/components/app/dashboards/welcome";

export default function PainelPage() {
  const session = useSession();
  if (!session) return null;
  switch (session.role) {
    case "admin_geral":
      return <AdminGeralDashboard session={session} />;
    case "administrador":
      return <AdministradorDashboard session={session} />;
    case "financeiro":
      return (
        <>
          <Welcome name={session.name} subtitle="Indicadores financeiros, quotas e aprovação de comprovativos." image="/images/laguna/lazer/piscina-e-deck.webp" />
          <FinanceOverview />
        </>
      );
    case "porteiro":
      return <PorteiroDashboard session={session} />;
    case "morador":
      return <MoradorDashboard session={session} />;
  }
}
