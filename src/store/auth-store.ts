"use client";

import { create } from "zustand";
import type { Session } from "@/types";

interface AuthState {
  session: Session | null;
  /** Já foi verificada a sessão no servidor (cookie httpOnly). */
  checked: boolean;
  setSession: (s: Session | null) => void;
  load: () => Promise<Session | null>;
  logout: () => Promise<void>;
}

/**
 * Sessão autenticada. A credencial é um cookie httpOnly emitido pelo servidor — não é acessível ao
 * JavaScript nem guardada no localStorage. Aqui fica apenas o perfil do utilizador em memória.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  checked: false,
  setSession: (session) => set({ session, checked: true }),
  load: async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const session = res.ok ? (((await res.json()).session as Session | null) ?? null) : null;
      set({ session, checked: true });
      return session;
    } catch {
      set({ checked: true });
      return null;
    }
  },
  logout: async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    set({ session: null, checked: true });
  },
}));
