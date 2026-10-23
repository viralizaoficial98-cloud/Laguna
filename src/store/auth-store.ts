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
      // v3: perfil Gestor Financeiro (Saraiva) e nova matriz de permissões — sessões antigas são terminadas
      version: 3,
      migrate: () => ({ session: null }) as unknown as AuthState,
    },
  ),
);
