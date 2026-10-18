"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** true depois da hidratação no cliente (evita divergências com o localStorage). */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
