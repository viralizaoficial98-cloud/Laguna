"use client";

import { useMemo } from "react";
import type { Visit } from "@/types";
import { guestPresence, useDemoStore } from "@/store/demo-store";

export interface VisitRow extends Visit {
  residentName: string;
  block: string;
  number: string;
  inside: number;
  left: number;
  waiting: number;
}

/** Visitas enriquecidas com morador, bloco, apartamento e presença dos convidados. */
export function useVisitRows(filter?: (v: Visit) => boolean) {
  const visits = useDemoStore((s) => s.visits);
  const checks = useDemoStore((s) => s.visitChecks);
  const residents = useDemoStore((s) => s.residents);
  const apartments = useDemoStore((s) => s.apartments);

  return useMemo<VisitRow[]>(
    () =>
      visits
        .filter((v) => (filter ? filter(v) : true))
        .map((v) => {
          const apt = apartments.find((a) => a.id === v.apartmentId);
          const presence = v.guests.map((g) => guestPresence(checks, v.id, g.id));
          return {
            ...v,
            residentName: residents.find((r) => r.id === v.residentId)?.name ?? "—",
            block: apt?.block ?? v.apartmentId.split("_")[1] ?? "—",
            number: apt?.number ?? v.apartmentId.split("_")[2] ?? "—",
            inside: presence.filter((p) => p === "no_interior").length,
            left: presence.filter((p) => p === "saiu").length,
            waiting: presence.filter((p) => p === "aguardando").length,
          };
        })
        .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visits, checks, residents, apartments],
  );
}
