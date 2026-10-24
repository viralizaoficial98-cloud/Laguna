"use client";

/**
 * Estado de negócio no cliente, sincronizado com o servidor (MySQL).
 *
 * - Leitura: GET /api/state devolve os dados que o perfil autenticado pode ver (projecção no servidor).
 * - Escrita: cada acção é executada primeiro localmente (resposta imediata, mesmas regras do servidor)
 *   e enviada para POST /api/actions, onde é repetida dentro de uma transacção com a sessão real.
 *   O estado devolvido pelo servidor substitui o estado local — o servidor é a fonte de verdade.
 * - Sincronização entre dispositivos: actualização periódica e ao regressar ao separador.
 *
 * O localStorage NÃO é usado para dados de negócio.
 */
import { create } from "zustand";
import { toast } from "sonner";
import { createActions, emptyData, runWithContext, setDefaultSessionProvider, type DemoActions, type DemoData, type DomainSet } from "@/domain/engine";
import { useAuthStore } from "@/store/auth-store";
import { uploadInlineFiles } from "@/lib/api-client";

export { RESERVATION_CONFLICT_MSG, BLOCKING_RESERVATION, unpaidStatus, guestPresence, formatApt, aptLabel, accountFor } from "@/domain/engine";
export type { DemoData } from "@/domain/engine";

interface SyncState {
  /** Dados já carregados do servidor. */
  loaded: boolean;
  /** Versão dos dados no servidor (incrementada em cada escrita). */
  version: number;
  pending: number;
  loadError?: string;
  refresh: (force?: boolean) => Promise<void>;
  clear: () => void;
}

type Store = DemoData & DemoActions & SyncState;

setDefaultSessionProvider(() => useAuthStore.getState().session);

const NOT_SYNCED = new Set<keyof DemoActions>(["resetDemo"]);

function newSeed() {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 10);
}

let chain: Promise<unknown> = Promise.resolve();
let latest: { state: DemoData; version: number } | null = null;

export const useDemoStore = create<Store>()((set, get) => {
  const raw = createActions(set as unknown as DomainSet, get);

  const apply = (state: DemoData, version: number) => set({ ...state, version, loaded: true, loadError: undefined });

  async function send(name: string, args: unknown[], seed: string) {
    try {
      const trimmed = [...args];
      while (trimmed.length && trimmed[trimmed.length - 1] === undefined) trimmed.pop();
      const prepared = await uploadInlineFiles(trimmed);
      const res = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, args: prepared, seed }) });
      const json = (await res.json().catch(() => ({}))) as { state?: DemoData; version?: number; error?: string };
      if (res.status === 401) {
        useAuthStore.getState().setSession(null);
        return;
      }
      if (!res.ok) toast.error(json.error ?? "A operação não foi aceite pelo servidor.", { description: "Os dados foram repostos a partir do servidor." });
      if (json.state) latest = { state: json.state, version: json.version ?? 0 };
    } catch {
      toast.error("Sem ligação ao servidor — a operação não foi guardada.");
    } finally {
      const pending = get().pending - 1;
      set({ pending });
      if (pending === 0) {
        if (latest) apply(latest.state, latest.version);
        else void get().refresh(true);
        latest = null;
      }
    }
  }

  const wrapped = Object.fromEntries(
    Object.entries(raw).map(([name, fn]) => [
      name,
      (...args: unknown[]) => {
        if (NOT_SYNCED.has(name as keyof DemoActions)) throw new Error("Operação indisponível: os dados estão guardados na base de dados.");
        const seed = newSeed();
        // execução optimista (mesmas regras e permissões); um erro aqui não chega ao servidor
        const result = runWithContext({ seed }, () => (fn as (...a: unknown[]) => unknown)(...args));
        set({ pending: get().pending + 1 });
        chain = chain.then(() => send(name, args, seed));
        return result;
      },
    ]),
  ) as unknown as DemoActions;

  return {
    ...emptyData(),
    loaded: false,
    version: 0,
    pending: 0,
    ...wrapped,
    refresh: async (force = false) => {
      if (get().pending > 0) return;
      try {
        const res = await fetch(`/api/state${force ? "" : `?v=${get().version}`}`, { cache: "no-store" });
        if (res.status === 401) {
          useAuthStore.getState().setSession(null);
          return;
        }
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Erro ${res.status}`);
        const json = (await res.json()) as { unchanged?: boolean; state?: DemoData; version: number };
        if (get().pending > 0) return;
        if (json.state) apply(json.state, json.version);
      } catch (e) {
        if (!get().loaded) set({ loadError: e instanceof Error ? e.message : "Não foi possível carregar os dados." });
      }
    },
    clear: () => set({ ...emptyData(), loaded: false, version: 0 }),
  };
});
