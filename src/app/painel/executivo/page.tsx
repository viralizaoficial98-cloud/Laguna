"use client";

import { useSession } from "@/hooks/use-session";
import { ExecutiveDashboard } from "@/components/app/dashboards/executive-dashboard";

export default function ExecutivoPage() {
  const session = useSession();
  return session ? <ExecutiveDashboard session={session} /> : null;
}
