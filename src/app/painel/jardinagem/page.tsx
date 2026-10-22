"use client";

import { OpsModule } from "@/components/app/ops-module";
import { GARDEN_AREAS, GARDEN_TYPES, TEAMS } from "@/data/operations";

export default function JardinagemPage() {
  return (
    <OpsModule
      config={{
        area: "jardinagem",
        title: "Jardinagem",
        description: "Manutenção de jardins, rega, poda, limpeza de áreas verdes e tratamento de plantas.",
        types: GARDEN_TYPES,
        locations: GARDEN_AREAS,
        teams: TEAMS.jardinagem,
      }}
    />
  );
}
