/**
 * DADOS DE DEMONSTRAÇÃO operacionais e de despesas.
 *
 * - O inventário de elevadores é FICTÍCIO (1 por bloco) e está marcado `demo: true`:
 *   a quantidade real de elevadores por bloco deve ser configurada pelo Gestor Operacional.
 * - Equipas, prestadores, actividades, custos e despesas são simulados para demonstração.
 * - Só são usadas áreas comuns identificadas nas fotografias (entrada, piscinas, deck, zona de estar,
 *   pérgola/espaços verdes) e os halls/escadas dos blocos.
 */
import type { Elevator, Expense, ExpenseCategory, Occurrence, OccurrenceCategory, OccurrencePriority, OpsTask } from "@/types";
import { quarterOf, seededRandom, todayISO } from "@/lib/utils";
import { BLOCKS, aptId } from "./management";

/** Os dados operacionais de demonstração são gerados relativamente à data actual. */
const DEMO_TODAY = todayISO();

export const GESTOR_NAME = "Nelson Rodrigues";

export const OCCURRENCE_CATEGORIES: OccurrenceCategory[] = ["Elevadores", "Electricidade", "Água", "Canalização", "Limpeza", "Jardinagem", "Segurança", "Infraestruturas", "Outras"];

export const TEAMS = {
  limpeza: ["Equipa de Limpeza A (demo)", "Equipa de Limpeza B (demo)"],
  jardinagem: ["Equipa de Jardinagem (demo)"],
  manutencao: ["Técnico de manutenção interno (demo)", "Prestador de electricidade (demo)", "Prestador de canalização (demo)", "Prestador de elevadores (a definir)"],
};

export const CLEANING_AREAS = ["Entrada principal", "Zona da piscina", "Deck e solário", "Zona de estar exterior", ...BLOCKS.map((b) => `Hall e escadas — Bloco ${b}`)];
export const GARDEN_AREAS = ["Palmeiras da zona da piscina", "Ilha ajardinada da piscina", "Vasos ornamentais do deck", "Pérgola e espaços verdes", "Jardim da entrada principal"];
export const GARDEN_TYPES = ["Manutenção de jardins", "Rega", "Poda", "Limpeza de áreas verdes", "Tratamento de plantas"];

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return iso(d);
}
function pick<T>(arr: T[], r: () => number) {
  return arr[Math.floor(r() * arr.length)];
}

// ————— Elevadores (inventário de demonstração) —————

export const seedElevators: Elevator[] = BLOCKS.map((b, i) => {
  const status = b === "09" ? "avariado" : b === "07" ? "em_manutencao" : "operacional";
  const last = addDays(DEMO_TODAY, -(10 + i * 4));
  return {
    id: `elv_${b}`,
    block: b,
    code: `ELV-${b}-A`,
    status,
    lastMaintenance: last,
    nextMaintenance: addDays(last, 90),
    provider: "Prestador de elevadores (a definir)",
    demo: true,
    notes: "Registo de demonstração — confirmar o número real de elevadores do bloco.",
    history: [
      { id: `elh_${b}_1`, at: `${last}T10:00:00`, by: GESTOR_NAME, type: "manutencao" as const, description: "Manutenção preventiva trimestral (demo).", status: "operacional" as const },
      ...(status === "avariado"
        ? [{ id: `elh_${b}_2`, at: "2026-10-20T08:15:00", by: GESTOR_NAME, type: "avaria" as const, description: "Elevador parado entre pisos; porta não fecha (demo).", status: "avariado" as const }]
        : status === "em_manutencao"
          ? [{ id: `elh_${b}_2`, at: "2026-10-21T09:00:00", by: GESTOR_NAME, type: "manutencao" as const, description: "Substituição de cabos de tracção em curso (demo).", status: "em_manutencao" as const }]
          : []),
    ],
  };
});

// ————— Ocorrências —————

const OCC_TEMPLATES: { category: OccurrenceCategory; title: string; location: (b: string) => string }[] = [
  { category: "Elevadores", title: "Elevador com ruído anormal", location: (b) => `Bloco ${b} — elevador` },
  { category: "Electricidade", title: "Iluminação do hall sem funcionar", location: (b) => `Bloco ${b} — hall` },
  { category: "Água", title: "Baixa pressão de água", location: (b) => `Bloco ${b}` },
  { category: "Canalização", title: "Fuga de água na coluna", location: (b) => `Bloco ${b} — escadas` },
  { category: "Limpeza", title: "Escadas por limpar", location: (b) => `Bloco ${b} — escadas` },
  { category: "Jardinagem", title: "Palmeira com folhas secas", location: () => "Zona da piscina" },
  { category: "Segurança", title: "Portão da entrada não fecha", location: () => "Entrada principal" },
  { category: "Infraestruturas", title: "Mosaico solto no deck", location: () => "Deck e solário" },
  { category: "Outras", title: "Contentores de resíduos cheios", location: (b) => `Bloco ${b} — exterior` },
];
const PRIORITIES: OccurrencePriority[] = ["baixa", "media", "media", "alta", "urgente"];

export const seedOccurrences: Occurrence[] = (() => {
  const r = seededRandom(404);
  const list: Occurrence[] = [];
  for (let i = 0; i < 46; i++) {
    const t = pick(OCC_TEMPLATES, r);
    const b = pick(BLOCKS, r);
    const created = addDays(DEMO_TODAY, -Math.floor(r() * 210));
    const age = (new Date(`${DEMO_TODAY}T12:00:00`).getTime() - new Date(`${created}T12:00:00`).getTime()) / 86400000;
    const resolved = age > 12 ? r() < 0.93 : age > 3 ? r() < 0.55 : r() < 0.2;
    const days = 1 + Math.floor(r() * (t.category === "Elevadores" ? 6 : 4));
    const resolvedAt = resolved ? `${addDays(created, Math.min(days, Math.floor(age)))}T16:00:00` : undefined;
    const status = resolved ? "resolvida" : pick(["aberta", "em_analise", "em_execucao"] as const, r);
    const priority = t.category === "Elevadores" || t.category === "Segurança" ? pick(["alta", "urgente"] as const, r) : pick(PRIORITIES, r);
    const createdAt = `${created}T${String(7 + Math.floor(r() * 12)).padStart(2, "0")}:${String(Math.floor(r() * 59)).padStart(2, "0")}:00`;
    const team = t.category === "Limpeza" ? TEAMS.limpeza[0] : t.category === "Jardinagem" ? TEAMS.jardinagem[0] : t.category === "Elevadores" ? TEAMS.manutencao[3] : t.category === "Electricidade" ? TEAMS.manutencao[1] : t.category === "Canalização" || t.category === "Água" ? TEAMS.manutencao[2] : TEAMS.manutencao[0];
    list.push({
      id: `oc_${i + 1}`,
      title: t.title,
      description: `${t.title} — registo de demonstração.`,
      category: t.category,
      priority,
      status,
      block: t.location(b).startsWith("Bloco") ? b : undefined,
      location: t.location(b),
      assignee: status === "aberta" ? undefined : team,
      elevatorId: t.category === "Elevadores" ? `elv_${b}` : undefined,
      createdAt,
      resolvedAt,
      resolution: resolved ? "Intervenção concluída e verificada (demo)." : undefined,
      reportedBy: r() < 0.4 ? "Morador (demo)" : GESTOR_NAME,
      history: [
        { id: `oh_${i}_1`, at: createdAt, by: GESTOR_NAME, role: "gestor", text: "Ocorrência registada.", status: "aberta" },
        ...(resolvedAt ? [{ id: `oh_${i}_2`, at: resolvedAt, by: GESTOR_NAME, role: "gestor" as const, text: "Resolvida.", status: "resolvida" as const }] : []),
      ],
    });
  }
  // casos actuais ligados aos elevadores e ao morador de demonstração
  list.push(
    {
      id: "oc_elv09",
      title: "Elevador do Bloco 09 avariado",
      description: "Elevador parado entre pisos; porta não fecha.",
      category: "Elevadores",
      priority: "urgente",
      status: "em_execucao",
      block: "09",
      location: "Bloco 09 — elevador",
      assignee: TEAMS.manutencao[3],
      elevatorId: "elv_09",
      createdAt: "2026-10-20T08:15:00",
      reportedBy: GESTOR_NAME,
      history: [
        { id: "oh_e9_1", at: "2026-10-20T08:15:00", by: GESTOR_NAME, role: "gestor", text: "Avaria registada no módulo Elevadores.", status: "aberta" },
        { id: "oh_e9_2", at: "2026-10-20T10:00:00", by: GESTOR_NAME, role: "gestor", text: "Técnico contactado; intervenção agendada.", status: "em_execucao" },
      ],
    },
    {
      id: "oc_demo_morador",
      title: "Lâmpada fundida no hall do 2.º piso",
      description: "A iluminação do hall junto ao apartamento 201 não funciona.",
      category: "Electricidade",
      priority: "media",
      status: "em_analise",
      block: "06",
      apartmentId: aptId("06", "201"),
      residentId: "res_demo",
      location: "Bloco 06 — 2.º piso",
      createdAt: "2026-10-18T07:45:00",
      reportedBy: "Manuel Muenho",
      history: [
        { id: "oh_m_1", at: "2026-10-18T07:45:00", by: "Manuel Muenho", role: "morador", text: "Ocorrência submetida pelo morador.", status: "aberta" },
        { id: "oh_m_2", at: "2026-10-18T09:10:00", by: GESTOR_NAME, role: "gestor", text: "Em análise pelo técnico interno.", status: "em_analise" },
      ],
    },
  );
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
})();

// ————— Actividades operacionais —————

export const seedOpsTasks: OpsTask[] = (() => {
  const r = seededRandom(909);
  const tasks: OpsTask[] = [];
  const today = DEMO_TODAY;
  const conclude = (t: OpsTask, delay = 0): OpsTask => {
    const executed = addDays(t.scheduledDate, delay);
    const ok = r() < 0.88;
    return {
      ...t,
      status: "concluida",
      executedDate: executed,
      inspection: r() < 0.8 ? { result: ok ? "conforme" : "nao_conforme", notes: ok ? undefined : "Execução incompleta — repetir (demo).", by: GESTOR_NAME, at: `${executed}T17:00:00` } : undefined,
    };
  };

  // Limpeza: plano diário/semanal — últimas 6 semanas e próximas 2
  for (let d = -42; d <= 14; d++) {
    const date = addDays(today, d);
    const dow = new Date(`${date}T12:00:00`).getDay();
    const daily = ["Entrada principal", "Zona da piscina"];
    const weekly = dow === 1 ? CLEANING_AREAS.slice(4, 9) : dow === 4 ? CLEANING_AREAS.slice(9) : dow === 3 ? ["Deck e solário", "Zona de estar exterior"] : [];
    [...daily, ...weekly].forEach((area, k) => {
      const base: OpsTask = {
        id: `cln_${d + 50}_${k}`,
        area: "limpeza",
        type: daily.includes(area) ? "Limpeza diária" : "Limpeza profunda",
        title: `${daily.includes(area) ? "Limpeza diária" : "Limpeza semanal"} — ${area}`,
        location: area,
        block: area.includes("Bloco") ? area.slice(-2) : undefined,
        responsible: TEAMS.limpeza[k % 2],
        frequency: daily.includes(area) ? "Diária" : "Semanal",
        scheduledDate: date,
        status: "programada",
      };
      // actividades antigas foram executadas (algumas com atraso); só as mais recentes podem estar em falta
      if (d < -7) tasks.push(conclude(base, r() < 0.08 ? 1 : 0));
      else if (d < 0) tasks.push(r() < 0.9 ? conclude(base) : base);
      else if (d === 0) tasks.push(r() < 0.5 ? conclude(base) : { ...base, status: "em_execucao" });
      else tasks.push(base);
    });
  }

  // Jardinagem: semanal por área + rega
  for (let w = -8; w <= 3; w++) {
    GARDEN_AREAS.forEach((area, k) => {
      const date = addDays(today, w * 7 + (k % 5) - 2);
      const type = k === 0 && w % 4 === 0 ? "Poda" : k === 2 ? "Rega" : k === 1 && w % 3 === 0 ? "Tratamento de plantas" : k === 4 ? "Limpeza de áreas verdes" : "Manutenção de jardins";
      const base: OpsTask = {
        id: `grd_${w + 10}_${k}`,
        area: "jardinagem",
        type,
        title: `${type} — ${area}`,
        location: area,
        responsible: TEAMS.jardinagem[0],
        frequency: type === "Poda" ? "Mensal" : "Semanal",
        scheduledDate: date,
        status: "programada",
      };
      if (date < addDays(today, -10)) tasks.push(conclude(base, Math.floor(r() * 2)));
      else if (date < today) tasks.push(r() < 0.85 ? conclude(base, Math.floor(r() * 2)) : base);
      else tasks.push(base);
    });
  }

  // Manutenção preventiva e correctiva (com custos previstos/efectivos de demonstração)
  const maint: [string, string, string, string, number][] = [
    ["Preventiva", "Limpeza de filtros e bombas da piscina", "Zona da piscina", "Bombas e filtragem", 180_000],
    ["Preventiva", "Revisão da iluminação exterior", "Áreas comuns exteriores", "Iluminação exterior", 240_000],
    ["Preventiva", "Revisão do portão da entrada principal", "Entrada principal", "Portão automático", 150_000],
    ["Preventiva", "Inspecção dos quadros eléctricos", "Blocos 01 a 10", "Quadros eléctricos", 420_000],
    ["Preventiva", "Manutenção trimestral dos elevadores", "Blocos 01 a 10", "Elevadores", 1_500_000],
    ["Correctiva", "Reparação de fuga na coluna de água", "Bloco 03 — escadas", "Rede de água", 260_000],
    ["Correctiva", "Substituição de luminárias do hall", "Bloco 06 — 2.º piso", "Iluminação interior", 85_000],
    ["Correctiva", "Reparação do elevador", "Bloco 09 — elevador", "Elevador ELV-09-A", 900_000],
    ["Correctiva", "Substituição de cabos de tracção", "Bloco 07 — elevador", "Elevador ELV-07-A", 1_200_000],
    ["Correctiva", "Reparação de mosaico do deck", "Deck e solário", "Pavimento", 120_000],
    ["Preventiva", "Tratamento químico da água das piscinas", "Zona da piscina", "Piscinas", 210_000],
    ["Preventiva", "Desinfestação das áreas comuns", "Áreas comuns", "—", 300_000],
  ];
  for (let q = 0; q < 4; q++) {
    maint.forEach(([type, title, location, equipment, cost], k) => {
      if (type === "Correctiva" && k % 2 !== q % 2 && q < 3) return;
      const date = addDays(today, -270 + q * 91 + k * 6);
      const base: OpsTask = {
        id: `mnt_${q}_${k}`,
        area: "manutencao",
        type,
        title,
        location,
        block: location.startsWith("Bloco ") && location[7] !== " " ? location.slice(6, 8) : undefined,
        responsible: equipment.startsWith("Elevador") ? TEAMS.manutencao[3] : title.includes("eléctric") || title.includes("luminár") || title.includes("iluminação") ? TEAMS.manutencao[1] : title.includes("água") || title.includes("fuga") ? TEAMS.manutencao[2] : TEAMS.manutencao[0],
        frequency: type === "Preventiva" ? "Trimestral" : "Pontual",
        scheduledDate: date,
        dueDate: addDays(date, type === "Correctiva" ? 5 : 10),
        equipment,
        estimatedCost: cost,
        status: "programada",
      };
      if (date < addDays(today, -6)) {
        const c = conclude(base, Math.floor(r() * 6));
        tasks.push({ ...c, actualCost: Math.round((cost * (0.85 + r() * 0.35)) / 1000) * 1000 });
      } else if (date < today) tasks.push({ ...base, status: r() < 0.5 ? "em_execucao" : "programada" });
      else tasks.push(base);
    });
  }
  return tasks;
})();

// ————— Despesas fixas (contratos de serviços) — valores de demonstração —————

const MONTHLY_CONTRACTS: { category: ExpenseCategory; description: string; amount: number }[] = [
  { category: "Limpeza", description: "Contrato de limpeza das áreas comuns", amount: 1_850_000 },
  { category: "Jardinagem", description: "Contrato de jardinagem", amount: 650_000 },
  { category: "Segurança e portaria", description: "Serviço de portaria e segurança", amount: 2_400_000 },
  { category: "Energia e água", description: "Energia e água das áreas comuns", amount: 1_300_000 },
  { category: "Elevadores", description: "Contrato de assistência a elevadores", amount: 550_000 },
  { category: "Administração", description: "Despesas administrativas e bancárias", amount: 320_000 },
];

export const seedExpenses: Expense[] = (() => {
  const r = seededRandom(31);
  const list: Expense[] = [];
  const months = ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
  months.forEach((m) =>
    MONTHLY_CONTRACTS.forEach((c, k) => {
      const date = `${m}-${String(5 + k).padStart(2, "0")}`;
      const variance = c.category === "Energia e água" ? 0.8 + r() * 0.4 : 1;
      list.push({ id: `exp_${m}_${k}`, date, period: quarterOf(date), category: c.category, description: c.description, amount: Math.round((c.amount * variance) / 1000) * 1000 });
    }),
  );
  return list;
})();

export const EXPENSE_CATEGORIES: ExpenseCategory[] = ["Limpeza", "Jardinagem", "Manutenção", "Elevadores", "Segurança e portaria", "Energia e água", "Administração"];
