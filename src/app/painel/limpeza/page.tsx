"use client";

import { OpsModule } from "@/components/app/ops-module";
import { CLEANING_AREAS, TEAMS } from "@/data/operations";

export default function LimpezaPage() {
  return (
    <OpsModule
      config={{
        area: "limpeza",
        title: "Limpeza",
        description: "Plano de limpeza das áreas comuns, execução pelas equipas e fiscalização.",
        types: ["Limpeza diária", "Limpeza profunda", "Limpeza de vidros", "Recolha de resíduos"],
        locations: CLEANING_AREAS,
        teams: TEAMS.limpeza,
      }}
    />
  );
}
