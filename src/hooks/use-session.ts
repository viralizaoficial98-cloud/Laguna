"use client";

import { useAuthStore } from "@/store/auth-store";
import { useDemoStore } from "@/store/demo-store";

export function useSession() {
  return useAuthStore((s) => s.session);
}

/** Morador e apartamento associados à sessão demonstrativa (perfil Morador). */
export function useCurrentResident() {
  const session = useSession();
  const resident = useDemoStore((s) => s.residents.find((r) => r.id === session?.residentId));
  const apartment = useDemoStore((s) => s.apartments.find((a) => a.id === resident?.apartmentId));
  return { session, resident, apartment };
}
