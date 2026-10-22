"use client";

import { useSession } from "@/hooks/use-session";
import { ExecutiveDashboard } from "@/components/app/dashboards/executive-dashboard";
import { GestorDashboard } from "@/components/app/dashboards/gestor-dashboard";
import { PorteiroDashboard } from "@/components/app/dashboards/porteiro-dashboard";
import { MoradorDashboard } from "@/components/app/dashboards/morador-dashboard";

export default function PainelPage() {
  const session = useSession();
  if (!session) return null;
  switch (session.role) {
    case "administrador":
      return <ExecutiveDashboard session={session} />;
    case "gestor":
      return <GestorDashboard session={session} />;
    case "porteiro":
      return <PorteiroDashboard session={session} />;
    case "morador":
      return <MoradorDashboard session={session} />;
  }
}
