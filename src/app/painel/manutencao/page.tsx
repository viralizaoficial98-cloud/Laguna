"use client";

import { OpsModule } from "@/components/app/ops-module";
import { BLOCKS } from "@/data/management";
import { TEAMS } from "@/data/operations";

export default function ManutencaoPage() {
  return (
    <OpsModule
      config={{
        area: "manutencao",
        title: "Manutenção",
        description: "Manutenção preventiva e correctiva de equipamentos e infraestruturas, prestadores, prazos e custos.",
        types: ["Preventiva", "Correctiva"],
        locations: ["Zona da piscina", "Entrada principal", "Áreas comuns exteriores", "Deck e solário", ...BLOCKS.map((b) => `Bloco ${b}`)],
        teams: TEAMS.manutencao,
      }}
    />
  );
}
