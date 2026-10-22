"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Session } from "@/types";

interface AuthState {
  session: Session | null;
  setSession: (s: Session | null) => void;
}

/** Sessão DEMONSTRATIVA guardada no browser. Não protege dados reais. */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
    }),
    {
      name: "laguna-demo-session",
      storage: createJSONStorage(() => localStorage),
      // v2: novos perfis (José Leiria, Nelson Rodrigues, Manuel Muenho, Portaria) — sessões antigas são terminadas
      version: 2,
      migrate: () => ({ session: null }) as unknown as AuthState,
    },
  ),
);

/**
 * APENAS DEMONSTRAÇÃO: executa uma acção como outro perfil (ex.: simular a validação
 * do Administrador a partir da conta do morador). Não existirá na versão com backend.
 */
export function withDemoRole<T>(role: Session["role"], fn: () => T): T {
  const original = useAuthStore.getState().session;
  if (!original) return fn();
  useAuthStore.setState({ session: { ...original, role } });
  try {
    return fn();
  } finally {
    useAuthStore.setState({ session: original });
  }
}
