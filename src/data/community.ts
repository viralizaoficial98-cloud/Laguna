/**
 * DADOS DE DEMONSTRAÇÃO — salões, reservas, ocupações e processos de desocupação.
 * O número de salões do condomínio não está confirmado: é criado 1 salão de demonstração,
 * configurável pela Administração (adicionar, renomear, desactivar).
 */
import type { Hall, MoveOut, Occupancy, Reservation, Resident } from "@/types";
import { todayISO } from "@/lib/utils";
import { DEFAULT_SETTINGS, MOVEOUT_DEMO_APT, aptId } from "./management";

function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const seedHalls: Hall[] = [
  { id: "hall_1", name: "Salão de Festas", description: "Salão de festas do condomínio (registo de demonstração — confirmar características).", capacity: 80, active: true, demo: true },
];

const g = (prefix: string, names: string[]) => names.map((name, i) => ({ id: `${prefix}_${i}`, name }));

/** Reservas relativas à data actual, para o calendário ter sempre exemplos. */
export function createSeedReservations(): Reservation[] {
  const today = todayISO();
  const fee = DEFAULT_SETTINGS.reservationFee;
  const now = new Date().toISOString();
  const later = new Date(Date.now() + 30 * 3600 * 1000).toISOString();
  const confirmed = (id: string, date: string, residentId: string, apartmentId: string, eventName: string, eventType: string, guests: string[]): Reservation => ({
    id,
    hallId: "hall_1",
    residentId,
    apartmentId,
    date,
    startTime: "15:00",
    endTime: "22:00",
    eventType,
    eventName,
    expectedGuests: guests.length,
    guests: g(`${id}_g`, guests),
    fee,
    status: "confirmada",
    createdAt: `${addDays(date, -20)}T10:00:00`,
    payment: { reference: "TRF-RES-" + id.slice(-3), submittedAt: `${addDays(date, -18)}T10:00:00`, reviewedBy: "Saraiva", reviewedAt: `${addDays(date, -17)}T11:00:00`, receiptNumber: `REC-RES-${id.slice(-3)}` },
    history: [{ id: `${id}_h1`, at: `${addDays(date, -17)}T11:00:00`, by: "Saraiva", text: "Pagamento validado — reserva confirmada.", status: "confirmada" }],
  });
  return [
    confirmed("res_101", addDays(today, -40), "res_03_102", aptId("03", "102"), "Aniversário", "Aniversário", ["Convidado 1", "Convidado 2", "Convidado 3"]),
    confirmed("res_102", addDays(today, -12), "res_08_401", aptId("08", "401"), "Baptizado", "Festa familiar", ["Convidado A", "Convidado B"]),
    confirmed("res_103", addDays(today, 8), "res_10_502", aptId("10", "502"), "Festa de noivado", "Festa familiar", ["Ana Baptista", "Pedro Neto", "Isabel Gaspar", "Miguel Tavares", "Sara Lopes", "Bruno Costa"]),
    {
      id: "res_104",
      hallId: "hall_1",
      residentId: "res_01_101",
      apartmentId: aptId("01", "101"),
      date: addDays(today, 15),
      startTime: "14:00",
      endTime: "20:00",
      eventType: "Aniversário",
      eventName: "Aniversário infantil",
      expectedGuests: 30,
      guests: [],
      fee,
      status: "pendente_pagamento",
      createdAt: now,
      expiresAt: later,
      history: [{ id: "res_104_h1", at: now, by: "Morador (demo)", text: "Pedido de reserva — bloqueio provisório da data.", status: "pendente_pagamento" }],
    },
    {
      id: "res_105",
      hallId: "hall_1",
      residentId: "res_03_202",
      apartmentId: aptId("03", "202"),
      date: addDays(today, 22),
      startTime: "16:00",
      endTime: "23:00",
      eventType: "Reunião",
      eventName: "Reunião de família",
      expectedGuests: 25,
      guests: [],
      fee,
      status: "em_validacao",
      createdAt: now,
      payment: { reference: "", proof: { name: "comprovativo-reserva.pdf", type: "application/pdf", size: 120000 }, submittedAt: now },
      history: [{ id: "res_105_h1", at: now, by: "Morador (demo)", text: "Comprovativo de pagamento enviado.", status: "em_validacao" }],
    },
  ];
}

export function createSeedOccupancies(residents: Resident[]): Occupancy[] {
  return residents
    .filter((r) => r.apartmentId)
    .map((r) => ({ id: `occ_${r.id}`, apartmentId: r.apartmentId!, residentId: r.id, residentName: r.name, from: r.since }));
}

const emptyChecklist = (): MoveOut["operational"]["checklist"] => ({
  apartamento: { state: "pendente" },
  ocorrencias: { state: "pendente" },
  equipamentos: { state: "pendente" },
  chaves: { state: "pendente" },
  danos: { state: "pendente" },
  outras: { state: "pendente" },
});

export const newChecklist = emptyChecklist;

export function createSeedMoveOuts(residents: Resident[]): MoveOut[] {
  const r = residents.find((x) => x.apartmentId === MOVEOUT_DEMO_APT);
  if (!r) return [];
  const created = `${addDays(todayISO(), -3)}T10:30:00`;
  return [
    {
      id: "mov_1",
      reference: `DES-${todayISO().slice(0, 4)}-001`,
      residentId: r.id,
      residentName: r.name,
      apartmentId: MOVEOUT_DEMO_APT,
      block: "04",
      number: "302",
      typology: "T2",
      plannedDate: addDays(todayISO(), 20),
      reason: "Mudança de residência (demo)",
      contact: r.phone,
      status: "regularizacao_pendente",
      createdAt: created,
      financial: { status: "regularizacao_pendente", by: "Saraiva", at: `${addDays(todayISO(), -2)}T09:00:00`, notes: "Quotas em atraso por regularizar (demo)." },
      operational: { status: "pendente", checklist: emptyChecklist() },
      history: [
        { id: "mh1", at: created, by: r.name, text: "Solicitação de desocupação submetida.", status: "solicitacao_recebida" },
        { id: "mh2", at: `${addDays(todayISO(), -2)}T09:00:00`, by: "Saraiva", text: "Verificação financeira: existem valores em aberto.", status: "regularizacao_pendente" },
      ],
    },
  ];
}
