"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api-client";
import { useDemoStore } from "@/store/demo-store";

/**
 * Carrega dados de uma rota da API e volta a carregar quando os dados do servidor mudam
 * (versão sincronizada) ou quando `reload()` é chamado.
 */
export function useApi<T>(url: string | null) {
  const version = useDemoStore((s) => s.version);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    apiJson<T>(url)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Erro"));
    return () => {
      alive = false;
    };
  }, [url, version, tick]);
  return { data, error, reload, loading: !data && !error };
}
