"use client";

/**
 * Estado local da DEMONSTRAÇÃO.
 *
 * Funciona como um "repositório" em memória (persistido no localStorage do
 * browser) para que a interface possa ser testada sem backend. Os dados NÃO são
 * partilhados entre utilizadores nem dispositivos: a comunicação real entre
 * Morador, Portaria e Administração exige base de dados e autenticação no servidor.
 *
 * Todas as acções verificam a permissão do perfil autenticado (src/config/permissions.ts)
 * e lançam PermissionError quando a operação não é autorizada.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  AccessLog,
  Apartment,
  AuditEntry,
  Charge,
  Guest,
  Hall,
  MoveOut,
  MoveOutStatus,
  Occupancy,
  PaymentProof,
  Reservation,
  ReservationStatus,
  AppNotification,
  Circular,
  CondoDocument,
  CondoSettings,
  Elevator,
  ElevatorStatus,
  Expense,
  GuestPresence,
  InternalNotice,
  Occurrence,
  OccurrenceEvent,
  OpsTask,
  Payment,
  Quota,
  Resident,
  Visit,
  VisitCheck,
} from "@/types";
import {
  DEFAULT_SETTINGS,
  createManagementSeed,
  quotaDescription,
  quotaDueDate,
  seedAccessLogs,
  seedCirculars,
  seedDocuments,
  seedNotices,
  seedNotifications,
  seedVisitChecks,
  seedVisits,
} from "@/data/management";
import { seedElevators, seedExpenses, seedOccurrences, seedOpsTasks } from "@/data/operations";
import { createSeedMoveOuts, createSeedOccupancies, createSeedReservations, newChecklist, seedHalls } from "@/data/community";
import { computeAccount, quotaStatusFrom } from "@/lib/account";
import { can, PermissionError, type Permission } from "@/config/permissions";
import { useAuthStore } from "@/store/auth-store";
import { parseQuarter, quarterOf, todayISO, uid } from "@/lib/utils";

interface DemoData {
  settings: CondoSettings;
  apartments: Apartment[];
  residents: Resident[];
  quotas: Quota[];
  payments: Payment[];
  circulars: Circular[];
  notices: InternalNotice[];
  visits: Visit[];
  visitChecks: VisitCheck[];
  occurrences: Occurrence[];
  elevators: Elevator[];
  opsTasks: OpsTask[];
  expenses: Expense[];
  accessLogs: AccessLog[];
  documents: CondoDocument[];
  notifications: AppNotification[];
  halls: Hall[];
  reservations: Reservation[];
  charges: Charge[];
  occupancies: Occupancy[];
  moveOuts: MoveOut[];
  audit: AuditEntry[];
}

export const RESERVATION_CONFLICT_MSG = "Este salão já se encontra reservado para a data seleccionada. Por favor, escolha outra data disponível.";
/** Estados que ocupam a data de um salão (exclusividade por salão + data). */
export const BLOCKING_RESERVATION: ReservationStatus[] = ["pendente_pagamento", "em_validacao", "confirmada"];

interface DemoActions {
  saveApartment: (apt: Apartment) => void;
  deleteApartment: (id: string) => void;
  saveResident: (res: Resident) => void;
  deleteResident: (id: string) => void;
  updateSettings: (s: Partial<CondoSettings>) => void;
  /** Emite as quotas de um trimestre para todas as fracções activas ocupadas. Devolve o n.º emitido. */
  emitQuotas: (period: string) => number;
  submitPayment: (input: Omit<Payment, "id" | "status" | "submittedAt">) => Payment;
  /** Decisão ÚNICA sobre um comprovativo (Nelson, Saraiva ou José). Lança erro se já tiver sido decidido. */
  reviewPayment: (paymentId: string, decision: "aprovado" | "rejeitado", opts?: { note?: string; validatedAmount?: number }) => void;
  /** Gestor Financeiro: regista um pagamento recebido (ex.: numerário), já validado. */
  registerPayment: (input: { quotaId: string; amount: number; method: Payment["method"]; reference: string; paidAt: string; note?: string }) => Payment;
  addExpense: (e: Omit<Expense, "id" | "period">) => void;
  deleteExpense: (id: string) => void;
  saveHall: (h: Hall) => void;
  requestReservation: (input: Pick<Reservation, "hallId" | "date" | "startTime" | "endTime" | "eventType" | "eventName" | "expectedGuests" | "guests" | "notes">, opts?: { waitlist?: boolean }) => Reservation;
  submitReservationPayment: (id: string, input: { reference: string; proof?: PaymentProof }) => void;
  reviewReservationPayment: (id: string, decision: "aprovado" | "rejeitado", note?: string) => void;
  cancelReservation: (id: string, reason?: string) => void;
  updateReservationGuests: (id: string, guests: Guest[]) => void;
  /** Expira reservas provisórias não pagas e promove pedidos em espera. Devolve o n.º expirado. */
  expireReservations: () => number;
  proposeCharge: (c: Pick<Charge, "apartmentId" | "description" | "justification" | "amount" | "moveOutId">) => void;
  decideCharge: (id: string, decision: "confirmado" | "anulado" | "pago") => void;
  requestMoveOut: (input: { plannedDate: string; reason?: string; contact: string; notes?: string }) => MoveOut;
  runFinancialCheck: (id: string, notes?: string) => void;
  saveOperationalCheck: (id: string, input: { checklist: MoveOut["operational"]["checklist"]; notes?: string; report?: MoveOut["operational"]["report"]; conclude?: boolean }) => void;
  authorizeMoveOut: (id: string, notes?: string) => void;
  completeMoveOut: (id: string) => void;
  cancelMoveOut: (id: string, reason?: string) => void;
  saveCircular: (c: Circular) => void;
  deleteCircular: (id: string) => void;
  saveNotice: (n: InternalNotice) => void;
  deleteNotice: (id: string) => void;
  saveVisit: (v: Visit) => void;
  cancelVisit: (id: string) => void;
  checkGuest: (visitId: string, guestId: string, type: "entrada" | "saida") => void;
  /** Gestor: cria/edita ocorrências. */
  saveOccurrence: (o: Occurrence) => void;
  /** Morador: submete uma ocorrência da sua fracção. */
  reportOccurrence: (o: Pick<Occurrence, "title" | "description" | "category" | "location" | "photos">) => Occurrence;
  /** Gestor: muda estado/atribuição/prioridade com registo no histórico. */
  updateOccurrence: (id: string, patch: Partial<Pick<Occurrence, "status" | "assignee" | "priority" | "resolution">>, note?: string) => void;
  /** Administrador ou Gestor: nota de supervisão/observação no histórico. */
  addOccurrenceNote: (id: string, text: string) => void;
  saveElevator: (e: Elevator) => void;
  deleteElevator: (id: string) => void;
  /** Gestor: muda o estado do elevador e regista o evento (avaria, intervenção, manutenção). */
  setElevatorStatus: (id: string, status: ElevatorStatus, input: { type: "avaria" | "intervencao" | "manutencao" | "estado"; description: string; createOccurrence?: boolean }) => void;
  saveOpsTask: (t: OpsTask) => void;
  deleteOpsTask: (id: string) => void;
  addDocument: (d: CondoDocument) => void;
  deleteDocument: (id: string) => void;
  markNotificationsRead: (ids: string[]) => void;
  resetDemo: () => void;
}

function initialData(): DemoData {
  return {
    settings: DEFAULT_SETTINGS,
    ...createManagementSeed(DEFAULT_SETTINGS),
    circulars: seedCirculars,
    notices: seedNotices,
    visits: seedVisits,
    visitChecks: seedVisitChecks,
    occurrences: seedOccurrences,
    elevators: seedElevators,
    opsTasks: seedOpsTasks,
    expenses: seedExpenses,
    accessLogs: seedAccessLogs,
    documents: seedDocuments,
    notifications: seedNotifications,
    halls: seedHalls,
    reservations: createSeedReservations(),
    charges: [],
    occupancies: [],
    moveOuts: [],
    audit: [],
  };
}

function initialAll(): DemoData {
  const d = initialData();
  return { ...d, occupancies: createSeedOccupancies(d.residents), moveOuts: createSeedMoveOuts(d.residents) };
}

function addH(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 3600 * 1000).toISOString();
}

function upsert<T extends { id: string }>(list: T[], item: T) {
  const exists = list.some((x) => x.id === item.id);
  return exists ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];
}

function session() {
  return useAuthStore.getState().session;
}

/** Verificação de permissão ao nível da operação (não apenas da interface). */
function assertCan(permission: Permission) {
  if (!can(session()?.role, permission)) throw new PermissionError(permission);
}

function audit(action: string, entity: string, entityId: string, details?: string): AuditEntry {
  const sess = session();
  return { id: uid("aud"), at: new Date().toISOString(), by: sess?.name ?? "Sistema", role: sess?.role ?? "administrador", action, entity, entityId, details };
}

function notif(title: string, body: string, roles: AppNotification["roles"], href?: string): AppNotification {
  return { id: uid("ntf"), title, body, at: new Date().toISOString(), read: false, roles, href };
}

let receiptSeq = 0;
function receiptNumber(prefix = "REC") {
  receiptSeq += 1;
  return `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}${receiptSeq}`;
}

/** Estado de uma quota não paga em função da data limite. */
export function unpaidStatus(q: Pick<Quota, "dueDate">): Quota["status"] {
  return q.dueDate < todayISO() ? "em_atraso" : "pendente";
}

/** Presença actual de um convidado, calculada a partir do histórico de confirmações. */
export function guestPresence(checks: VisitCheck[], visitId: string, guestId: string): GuestPresence {
  const last = checks.filter((c) => c.visitId === visitId && c.guestId === guestId).sort((a, b) => a.at.localeCompare(b.at)).at(-1);
  return !last ? "aguardando" : last.type === "entrada" ? "no_interior" : "saiu";
}

/** Evita exceder a quota do localStorage com ficheiros grandes. */
const MAX_PERSISTED_FILE = 700_000;

const safeStorage = createJSONStorage(() => ({
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      /* armazenamento indisponível ou cheio — a demo continua em memória */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignorar */
    }
  },
}));

export const useDemoStore = create<DemoData & DemoActions>()(
  persist(
    (set, get) => ({
      ...initialAll(),

      saveApartment: (apt) => {
        assertCan("apartments.manage");
        set((s) => {
          // mantém a relação morador ↔ apartamento coerente
          const residents = s.residents.map((r) =>
            r.id === apt.residentId ? { ...r, apartmentId: apt.id } : r.apartmentId === apt.id && r.id !== apt.residentId ? { ...r, apartmentId: undefined } : r,
          );
          return { apartments: upsert(s.apartments, apt), residents };
        });
      },
      deleteApartment: (id) => {
        assertCan("apartments.manage");
        set((s) => ({
          apartments: s.apartments.filter((a) => a.id !== id),
          residents: s.residents.map((r) => (r.apartmentId === id ? { ...r, apartmentId: undefined } : r)),
        }));
      },

      saveResident: (res) => {
        // o morador pode actualizar os seus próprios dados de contacto
        const sess = session();
        if (!(sess?.role === "morador" && sess.residentId === res.id)) assertCan("residents.manage");
        set((s) => {
          const apartments = s.apartments.map((a) => {
            if (a.id === res.apartmentId) return { ...a, residentId: res.id, status: "ocupado" as const };
            if (a.residentId === res.id && a.id !== res.apartmentId) return { ...a, residentId: undefined };
            return a;
          });
          return { residents: upsert(s.residents, res), apartments };
        });
      },
      deleteResident: (id) => {
        assertCan("residents.manage");
        set((s) => ({
          residents: s.residents.filter((r) => r.id !== id),
          apartments: s.apartments.map((a) => (a.residentId === id ? { ...a, residentId: undefined } : a)),
        }));
      },

      updateSettings: (patch) => {
        // valores da reserva: Administração · quotas: Administração / Gestor Financeiro
        if ("reservationFee" in patch || "reservationHoldHours" in patch) assertCan("halls.manage");
        if ("quotaByTypology" in patch || "dueDay" in patch || "allowPartial" in patch) assertCan("quotas.manage");
        set((s) => ({ settings: { ...s.settings, ...patch }, audit: [audit("Configuração actualizada", "settings", "settings", JSON.stringify(patch)), ...s.audit] }));
      },

      emitQuotas: (period) => {
        assertCan("quotas.manage");
        const s = get();
        const { year, quarter } = parseQuarter(period);
        const existing = new Set(s.quotas.filter((q) => q.period === period).map((q) => q.apartmentId));
        const dueDate = quotaDueDate(period, s.settings.dueDay);
        // uma quota por fracção e por trimestre (sem cobrança duplicada); valor pela tipologia da fracção
        const created: Quota[] = s.apartments
          .filter((a) => a.active && !existing.has(a.id))
          .map((a) => ({
            id: `quo_${a.id}_${period}`,
            apartmentId: a.id,
            period,
            year,
            quarter,
            description: quotaDescription(period),
            amount: s.settings.quotaByTypology[a.typology],
            typology: a.typology,
            paidAmount: 0,
            dueDate,
            status: unpaidStatus({ dueDate }),
          }));
        set({ quotas: [...s.quotas, ...created], audit: [audit("Quotas emitidas", "quota", period, `${created.length} quotas`), ...s.audit] });
        return created.length;
      },

      submitPayment: (input) => {
        assertCan("payments.submit");
        const sess = session()!;
        const s = get();
        const resident = s.residents.find((r) => r.id === sess.residentId);
        const quota = s.quotas.find((q) => q.id === input.quotaId);
        if (!quota || quota.apartmentId !== resident?.apartmentId) throw new PermissionError("payments.submit");
        if (quota.status === "pago") throw new Error("Esta quota já se encontra paga.");
        if (s.payments.some((p) => p.quotaId === quota.id && p.status === "em_analise")) throw new Error("Já existe um comprovativo em validação para esta quota.");
        const remaining = quota.amount - quota.paidAmount;
        if (input.amount <= 0 || input.amount > remaining) throw new Error(`Valor inválido. Montante em dívida: ${remaining.toLocaleString("pt-AO")} Kz.`);
        if (input.amount < remaining && !s.settings.allowPartial) throw new Error("Os pagamentos parciais não estão autorizados.");
        const payment: Payment = { ...input, id: uid("pay"), status: "em_analise", submittedAt: new Date().toISOString() };
        const apt = s.apartments.find((a) => a.id === quota.apartmentId);
        set({
          payments: [payment, ...s.payments],
          quotas: s.quotas.map((q) => (q.id === input.quotaId ? { ...q, status: "em_analise", paymentId: payment.id } : q)),
          notifications: [
            notif(
              "Comprovativo para validação",
              `${sess.name} · Bloco ${apt?.block} · ${apt?.number} (${apt?.typology}) · ${quota.description} · ${input.amount.toLocaleString("pt-AO")} Kz${input.reference ? ` · ${input.reference}` : ""}`,
              ["gestor", "financeiro"],
              "/painel/pagamentos",
            ),
            ...s.notifications,
          ],
          audit: [audit("Comprovativo submetido", "payment", payment.id, `${quota.description} · ${input.amount} Kz`), ...s.audit],
        });
        return payment;
      },

      reviewPayment: (paymentId, decision, opts = {}) => {
        assertCan("payments.review");
        const sess = session()!;
        const s = get();
        const payment = s.payments.find((p) => p.id === paymentId);
        if (!payment) throw new Error("Pagamento inexistente.");
        // uma única decisão final por comprovativo — impede aprovações duplicadas ou contraditórias
        if (payment.status !== "em_analise")
          throw new Error(`Este comprovativo já foi ${payment.status === "aprovado" ? "aprovado" : "rejeitado"} por ${payment.reviewedBy ?? "outro responsável"}${payment.reviewedAt ? ` em ${new Date(payment.reviewedAt).toLocaleString("pt-PT")}` : ""}.`);
        if (decision === "rejeitado" && !opts.note?.trim()) throw new Error("Indique a justificação da rejeição.");
        const quota = s.quotas.find((q) => q.id === payment.quotaId)!;
        const validated = decision === "aprovado" ? (opts.validatedAmount ?? payment.amount) : undefined;
        if (validated !== undefined) {
          if (validated <= 0 || validated > quota.amount - quota.paidAmount) throw new Error("Valor validado inválido.");
          if (validated < quota.amount - quota.paidAmount && !s.settings.allowPartial) throw new Error("Os pagamentos parciais não estão autorizados.");
        }
        const now = new Date().toISOString();
        const updated: Payment = {
          ...payment,
          status: decision,
          reviewedBy: sess.name,
          reviewedByRole: sess.role,
          reviewedAt: now,
          note: opts.note?.trim() || undefined,
          validatedAmount: validated,
          receiptNumber: decision === "aprovado" ? receiptNumber() : undefined,
        };
        const payments = s.payments.map((p) => (p.id === paymentId ? updated : p));
        const recomputed = quotaStatusFrom(quota, payments.filter((p) => p.quotaId === quota.id));
        set({
          payments,
          quotas: s.quotas.map((q) => (q.id === quota.id ? { ...q, ...recomputed } : q)),
          notifications: [
            notif(
              decision === "aprovado" ? (recomputed.status === "parcial" ? "Pagamento parcialmente validado" : "Pagamento aprovado") : "Comprovativo rejeitado",
              `${quota.description} — ${decision === "aprovado" ? `${validated!.toLocaleString("pt-AO")} Kz validados por ${sess.name}.` : opts.note}`,
              ["morador"],
              "/painel/minhas-quotas",
            ),
            notif(`Comprovativo ${decision === "aprovado" ? "aprovado" : "rejeitado"} por ${sess.name}`, quota.description, ["gestor", "financeiro"].filter((r) => r !== sess.role) as AppNotification["roles"], "/painel/pagamentos"),
            ...s.notifications,
          ],
          audit: [audit(decision === "aprovado" ? "Pagamento aprovado" : "Pagamento rejeitado", "payment", paymentId, `${validated ?? 0} Kz · comprovativo ${payment.proof?.name ?? "—"}${opts.note ? ` · ${opts.note}` : ""}`), ...s.audit],
        });
      },

      registerPayment: (input) => {
        assertCan("payments.register");
        const sess = session()!;
        const s = get();
        const quota = s.quotas.find((q) => q.id === input.quotaId);
        if (!quota) throw new Error("Quota inexistente.");
        if (s.payments.some((p) => p.quotaId === quota.id && p.status === "em_analise")) throw new Error("Existe um comprovativo em validação para esta quota — decida-o primeiro.");
        const remaining = quota.amount - quota.paidAmount;
        if (input.amount <= 0 || input.amount > remaining) throw new Error(`Valor inválido. Montante em dívida: ${remaining.toLocaleString("pt-AO")} Kz.`);
        if (input.amount < remaining && !s.settings.allowPartial) throw new Error("Os pagamentos parciais não estão autorizados.");
        const now = new Date().toISOString();
        const apt = s.apartments.find((a) => a.id === quota.apartmentId);
        const payment: Payment = {
          id: uid("pay"),
          quotaId: quota.id,
          apartmentId: quota.apartmentId,
          residentId: apt?.residentId,
          amount: input.amount,
          method: input.method,
          reference: input.reference,
          paidAt: `${input.paidAt}T12:00:00`,
          submittedAt: now,
          status: "aprovado",
          reviewedBy: sess.name,
          reviewedByRole: sess.role,
          reviewedAt: now,
          validatedAmount: input.amount,
          registeredBy: sess.name,
          note: input.note,
          receiptNumber: receiptNumber(),
        };
        const payments = [payment, ...s.payments];
        set({
          payments,
          quotas: s.quotas.map((q) => (q.id === quota.id ? { ...q, ...quotaStatusFrom(q, payments.filter((p) => p.quotaId === q.id)), paymentId: payment.id } : q)),
          audit: [audit("Pagamento registado", "payment", payment.id, `${quota.description} · ${input.amount} Kz · ${input.method}`), ...s.audit],
        });
        return payment;
      },

      addExpense: (e) => {
        assertCan("expenses.manage");
        const exp: Expense = { ...e, id: uid("exp"), period: quarterOf(e.date) };
        set((s) => ({ expenses: [exp, ...s.expenses], audit: [audit("Despesa registada", "expense", exp.id, `${e.category} · ${e.amount} Kz`), ...s.audit] }));
      },
      deleteExpense: (id) => {
        assertCan("expenses.manage");
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id), audit: [audit("Despesa eliminada", "expense", id), ...s.audit] }));
      },

      saveHall: (h) => {
        assertCan("halls.manage");
        set((s) => ({ halls: upsert(s.halls, h) }));
      },

      requestReservation: (input, opts = {}) => {
        assertCan("reservations.request");
        get().expireReservations();
        const sess = session()!;
        const s = get();
        const resident = s.residents.find((r) => r.id === sess.residentId);
        if (!resident?.apartmentId) throw new PermissionError("reservations.request");
        const hall = s.halls.find((h) => h.id === input.hallId && h.active);
        if (!hall) throw new Error("Salão indisponível.");
        if (input.date <= todayISO()) throw new Error("Escolha uma data futura.");
        const holder = s.reservations.find((r) => r.hallId === input.hallId && r.date === input.date && BLOCKING_RESERVATION.includes(r.status));
        if (holder && !opts.waitlist) throw new Error(RESERVATION_CONFLICT_MSG);
        if (holder?.status === "confirmada") throw new Error(RESERVATION_CONFLICT_MSG);
        if (s.reservations.some((r) => r.residentId === resident.id && r.hallId === input.hallId && r.date === input.date && (BLOCKING_RESERVATION.includes(r.status) || r.status === "em_espera")))
          throw new Error("Já tem um pedido para este salão nesta data.");
        const now = new Date();
        const status: ReservationStatus = holder ? "em_espera" : "pendente_pagamento";
        const res: Reservation = {
          ...input,
          id: uid("rsv"),
          residentId: resident.id,
          apartmentId: resident.apartmentId,
          fee: s.settings.reservationFee,
          status,
          createdAt: now.toISOString(),
          expiresAt: status === "pendente_pagamento" ? addH(now, s.settings.reservationHoldHours) : undefined,
          history: [{ id: uid("rh"), at: now.toISOString(), by: sess.name, text: status === "em_espera" ? "Pedido em lista de espera." : "Pedido de reserva — data bloqueada provisoriamente até ao pagamento.", status }],
        };
        set({
          reservations: [res, ...s.reservations],
          notifications: [notif("Novo pedido de reserva", `${hall.name} · ${input.date} · ${input.eventName}`, ["financeiro"], "/painel/reservas"), ...s.notifications],
          audit: [audit("Reserva solicitada", "reservation", res.id, `${hall.name} · ${input.date} · ${status}`), ...s.audit],
        });
        return res;
      },

      submitReservationPayment: (id, input) => {
        assertCan("reservations.request");
        const sess = session()!;
        const s = get();
        const r = s.reservations.find((x) => x.id === id);
        if (!r || r.residentId !== sess.residentId) throw new PermissionError("reservations.request");
        if (r.status !== "pendente_pagamento") throw new Error("Esta reserva não está a aguardar pagamento.");
        const now = new Date().toISOString();
        set({
          reservations: s.reservations.map((x) =>
            x.id === id ? { ...x, status: "em_validacao", payment: { reference: input.reference, proof: input.proof, submittedAt: now }, history: [...x.history, { id: uid("rh"), at: now, by: sess.name, text: "Comprovativo de pagamento enviado.", status: "em_validacao" }] } : x,
          ),
          notifications: [notif("Pagamento de reserva para validação", `${r.eventName} · ${r.date} · ${r.fee.toLocaleString("pt-AO")} Kz`, ["financeiro"], "/painel/reservas"), ...s.notifications],
          audit: [audit("Pagamento de reserva submetido", "reservation", id), ...s.audit],
        });
      },

      reviewReservationPayment: (id, decision, note) => {
        assertCan("reservations.validate");
        const sess = session()!;
        const s = get();
        const r = s.reservations.find((x) => x.id === id);
        if (!r) throw new Error("Reserva inexistente.");
        if (r.status !== "em_validacao") throw new Error("Este pagamento já foi decidido.");
        if (decision === "rejeitado" && !note?.trim()) throw new Error("Indique a justificação da rejeição.");
        const now = new Date();
        const status: ReservationStatus = decision === "aprovado" ? "confirmada" : "pendente_pagamento";
        set({
          reservations: s.reservations.map((x) =>
            x.id === id
              ? {
                  ...x,
                  status,
                  expiresAt: status === "pendente_pagamento" ? addH(now, s.settings.reservationHoldHours) : undefined,
                  payment: { ...x.payment!, reviewedBy: sess.name, reviewedAt: now.toISOString(), note, receiptNumber: decision === "aprovado" ? receiptNumber("REC-RES") : undefined },
                  history: [...x.history, { id: uid("rh"), at: now.toISOString(), by: sess.name, text: decision === "aprovado" ? "Pagamento validado — reserva confirmada." : `Comprovativo rejeitado: ${note}`, status }],
                }
              : x,
          ),
          notifications: [notif(decision === "aprovado" ? "Reserva confirmada" : "Pagamento da reserva rejeitado", `${r.eventName} · ${r.date}${note ? ` — ${note}` : ""}`, ["morador"], "/painel/reservas"), ...s.notifications],
          audit: [audit(decision === "aprovado" ? "Reserva confirmada" : "Pagamento de reserva rejeitado", "reservation", id, note), ...s.audit],
        });
      },

      cancelReservation: (id, reason) => {
        const sess = session()!;
        const s = get();
        const r = s.reservations.find((x) => x.id === id);
        if (!r) throw new Error("Reserva inexistente.");
        const own = sess.role === "morador" && r.residentId === sess.residentId;
        if (!own && !can(sess.role, "reservations.validate") && sess.role !== "administrador") throw new PermissionError("reservations.validate");
        if (r.status === "cancelada" || r.status === "expirada") return;
        const now = new Date();
        let reservations = s.reservations.map((x) => (x.id === id ? { ...x, status: "cancelada" as const, history: [...x.history, { id: uid("rh"), at: now.toISOString(), by: sess.name, text: `Reserva cancelada${reason ? `: ${reason}` : ""}.`, status: "cancelada" as const }] } : x));
        reservations = promoteWaitlist(reservations, r.hallId, r.date, s.settings.reservationHoldHours);
        set({ reservations, audit: [audit("Reserva cancelada", "reservation", id, reason), ...s.audit] });
      },

      updateReservationGuests: (id, guests) => {
        const sess = session()!;
        const r = get().reservations.find((x) => x.id === id);
        if (!r || sess.role !== "morador" || r.residentId !== sess.residentId) throw new PermissionError("reservations.request");
        set((s) => ({ reservations: s.reservations.map((x) => (x.id === id ? { ...x, guests } : x)) }));
      },

      expireReservations: () => {
        const s = get();
        const now = new Date();
        const expired = s.reservations.filter((r) => r.status === "pendente_pagamento" && r.expiresAt && new Date(r.expiresAt) < now);
        if (!expired.length) return 0;
        let reservations = s.reservations.map((r) =>
          expired.some((e) => e.id === r.id) ? { ...r, status: "expirada" as const, history: [...r.history, { id: uid("rh"), at: now.toISOString(), by: "Sistema", text: "Reserva provisória expirada por falta de pagamento.", status: "expirada" as const }] } : r,
        );
        expired.forEach((e) => (reservations = promoteWaitlist(reservations, e.hallId, e.date, s.settings.reservationHoldHours)));
        set({ reservations, audit: [...expired.map((e) => ({ ...audit("Reserva expirada", "reservation", e.id), by: "Sistema" })), ...s.audit] });
        return expired.length;
      },

      proposeCharge: (c) => {
        assertCan("charges.propose");
        if (!c.justification.trim() || c.amount <= 0) throw new Error("O encargo exige fundamentação e valor.");
        const sess = session()!;
        const charge: Charge = { ...c, id: uid("chg"), date: todayISO(), status: "proposto", proposedBy: sess.name };
        set((s) => ({
          charges: [charge, ...s.charges],
          notifications: [notif("Encargo proposto para validação", `${c.description} · ${c.amount.toLocaleString("pt-AO")} Kz`, ["administrador"], "/painel/desocupacao"), ...s.notifications],
          audit: [audit("Encargo proposto", "charge", charge.id, `${c.amount} Kz · ${c.justification}`), ...s.audit],
        }));
      },

      decideCharge: (id, decision) => {
        // confirmar/anular: validação administrativa · liquidar: Gestor Financeiro
        assertCan(decision === "pago" ? "payments.register" : "charges.confirm");
        const sess = session()!;
        set((s) => ({
          charges: s.charges.map((c) => (c.id === id ? { ...c, status: decision, confirmedBy: decision === "confirmado" ? sess.name : c.confirmedBy } : c)),
          audit: [audit(`Encargo ${decision}`, "charge", id), ...s.audit],
        }));
      },

      requestMoveOut: (input) => {
        assertCan("moveout.request");
        const sess = session()!;
        const s = get();
        const resident = s.residents.find((r) => r.id === sess.residentId);
        const apt = s.apartments.find((a) => a.id === resident?.apartmentId);
        if (!resident || !apt) throw new PermissionError("moveout.request");
        if (s.moveOuts.some((m) => m.residentId === resident.id && !["concluida", "cancelada"].includes(m.status))) throw new Error("Já existe um processo de desocupação em curso.");
        if (!input.plannedDate || input.plannedDate < todayISO()) throw new Error("Indique uma data prevista de saída válida.");
        const year = todayISO().slice(0, 4);
        const seq = s.moveOuts.filter((m) => m.reference.includes(`-${year}-`)).length + 1;
        const now = new Date().toISOString();
        const mo: MoveOut = {
          id: uid("mov"),
          reference: `DES-${year}-${String(seq).padStart(3, "0")}`,
          residentId: resident.id,
          residentName: resident.name,
          apartmentId: apt.id,
          block: apt.block,
          number: apt.number,
          typology: apt.typology,
          plannedDate: input.plannedDate,
          reason: input.reason,
          contact: input.contact,
          notes: input.notes,
          status: "solicitacao_recebida",
          createdAt: now,
          financial: { status: "pendente" },
          operational: { status: "pendente", checklist: newChecklist() },
          history: [{ id: uid("mh"), at: now, by: resident.name, text: "Solicitação de desocupação submetida.", status: "solicitacao_recebida" }],
        };
        set({
          moveOuts: [mo, ...s.moveOuts],
          notifications: [notif(`Solicitação de desocupação ${mo.reference}`, `${resident.name} · Bloco ${apt.block} · ${apt.number} · saída prevista ${input.plannedDate}`, ["gestor", "financeiro", "administrador"], "/painel/desocupacao"), ...s.notifications],
          audit: [audit("Desocupação solicitada", "moveout", mo.id, mo.reference), ...s.audit],
        });
        return mo;
      },

      runFinancialCheck: (id, notes) => {
        assertCan("moveout.financial");
        const sess = session()!;
        const s = get();
        const m = s.moveOuts.find((x) => x.id === id);
        if (!m || ["concluida", "cancelada", "autorizada"].includes(m.status)) throw new Error("Processo não disponível para verificação.");
        const acc = accountFor(s, m);
        const ok = acc.canIssueClearance;
        const now = new Date().toISOString();
        const financial: MoveOut["financial"] = { status: ok ? "regularizada" : "regularizacao_pendente", by: sess.name, at: now, notes, debtAtCheck: acc.confirmedDebt + acc.inValidation };
        const status = nextMoveOutStatus({ ...m, financial });
        set({
          moveOuts: s.moveOuts.map((x) =>
            x.id === id
              ? { ...x, financial, status, history: [...x.history, { id: uid("mh"), at: now, by: sess.name, text: ok ? "Verificação financeira: situação regularizada." : `Verificação financeira: Regularização Financeira Pendente (${(acc.confirmedDebt + acc.inValidation).toLocaleString("pt-AO")} Kz).`, status }] }
              : x,
          ),
          notifications: ok ? s.notifications : [notif("Regularização Financeira Pendente", `Processo ${m.reference}: existem valores em aberto. Consulte a conta corrente.`, ["morador"], "/painel/desocupacao"), ...s.notifications],
          audit: [audit("Verificação financeira", "moveout", id, ok ? "regularizada" : `pendente ${acc.confirmedDebt}`), ...s.audit],
        });
      },

      saveOperationalCheck: (id, input) => {
        assertCan("moveout.operational");
        const sess = session()!;
        const s = get();
        const m = s.moveOuts.find((x) => x.id === id);
        if (!m || ["concluida", "cancelada", "autorizada"].includes(m.status)) throw new Error("Processo não disponível para verificação.");
        const items = Object.values(input.checklist);
        if (input.conclude && items.some((i) => i.state === "pendente" || i.state === "com_pendencias")) throw new Error("Existem itens pendentes ou com pendências — resolva-os antes de concluir a verificação operacional.");
        const now = new Date().toISOString();
        const operational: MoveOut["operational"] = { ...m.operational, checklist: input.checklist, notes: input.notes, report: input.report ?? m.operational.report, status: input.conclude ? "concluida" : "pendente", by: sess.name, at: now };
        const status = nextMoveOutStatus({ ...m, operational });
        set({
          moveOuts: s.moveOuts.map((x) => (x.id === id ? { ...x, operational, status, history: [...x.history, { id: uid("mh"), at: now, by: sess.name, text: input.conclude ? "Verificação operacional concluída." : "Verificação operacional actualizada.", status }] } : x)),
          audit: [audit(input.conclude ? "Verificação operacional concluída" : "Vistoria actualizada", "moveout", id), ...s.audit],
        });
      },

      authorizeMoveOut: (id, notes) => {
        assertCan("moveout.authorize");
        const sess = session()!;
        const s = get();
        const m = s.moveOuts.find((x) => x.id === id);
        if (!m) throw new Error("Processo inexistente.");
        if (m.authorization) throw new Error(`Este processo já foi autorizado por ${m.authorization.by}.`);
        const acc = accountFor(s, m);
        // a declaração de quitação NÃO pode ser emitida com dívidas confirmadas ou pagamentos por validar
        if (!acc.canIssueClearance) throw new Error(`Regularização Financeira Pendente: ${(acc.confirmedDebt + acc.inValidation).toLocaleString("pt-AO")} Kz em aberto ou por validar.`);
        if (m.financial.status !== "regularizada") throw new Error("A verificação financeira ainda não foi concluída.");
        if (m.operational.status !== "concluida") throw new Error("A verificação operacional ainda não foi concluída.");
        const now = new Date().toISOString();
        set({
          moveOuts: s.moveOuts.map((x) =>
            x.id === id ? { ...x, status: "autorizada", authorization: { by: sess.name, role: sess.role, at: now, notes }, history: [...x.history, { id: uid("mh"), at: now, by: sess.name, text: "Autorização administrativa de saída emitida.", status: "autorizada" }] } : x,
          ),
          notifications: [notif("Saída autorizada", `Processo ${m.reference} — Bloco ${m.block} · ${m.number}`, ["morador", "porteiro", "administrador"], "/painel/desocupacao"), ...s.notifications],
          audit: [audit("Saída autorizada", "moveout", id, notes), ...s.audit],
        });
      },

      completeMoveOut: (id) => {
        assertCan("moveout.complete");
        const sess = session()!;
        const s = get();
        const m = s.moveOuts.find((x) => x.id === id);
        if (!m || m.status !== "autorizada") throw new Error("Só é possível concluir processos autorizados.");
        const now = new Date().toISOString();
        const today = todayISO();
        // desocupação efectiva: liberta a fracção e preserva o histórico do antigo morador
        set({
          moveOuts: s.moveOuts.map((x) => (x.id === id ? { ...x, status: "concluida", completedAt: now, history: [...x.history, { id: uid("mh"), at: now, by: sess.name, text: "Desocupação concluída — fracção disponível.", status: "concluida" }] } : x)),
          apartments: s.apartments.map((a) => (a.id === m.apartmentId ? { ...a, status: "disponivel", residentId: undefined } : a)),
          residents: s.residents.map((r) => (r.id === m.residentId ? { ...r, status: "inactivo", apartmentId: undefined, notes: `Antigo morador de Bloco ${m.block} · ${m.number} — saída em ${today} (processo ${m.reference}).` } : r)),
          occupancies: s.occupancies.map((o) => (o.residentId === m.residentId && o.apartmentId === m.apartmentId && !o.to ? { ...o, to: today } : o)),
          audit: [audit("Desocupação concluída", "moveout", id, m.reference), ...s.audit],
        });
      },

      cancelMoveOut: (id, reason) => {
        const sess = session()!;
        const s = get();
        const m = s.moveOuts.find((x) => x.id === id);
        if (!m) throw new Error("Processo inexistente.");
        const own = sess.role === "morador" && m.residentId === sess.residentId;
        if (!own && !can(sess.role, "moveout.complete")) throw new PermissionError("moveout.complete");
        if (["concluida", "cancelada"].includes(m.status)) return;
        const now = new Date().toISOString();
        set({
          moveOuts: s.moveOuts.map((x) => (x.id === id ? { ...x, status: "cancelada", history: [...x.history, { id: uid("mh"), at: now, by: sess.name, text: `Processo cancelado${reason ? `: ${reason}` : ""}.`, status: "cancelada" }] } : x)),
          audit: [audit("Desocupação cancelada", "moveout", id, reason), ...s.audit],
        });
      },

      saveCircular: (c) => {
        assertCan("circulars.issue");
        const dup = get().circulars.some((x) => x.id !== c.id && x.year === c.year && x.sequence === c.sequence);
        if (dup) throw new Error(`Já existe a circular ${c.number}.`);
        set((s) => ({ circulars: upsert(s.circulars, c) }));
      },
      deleteCircular: (id) => {
        assertCan("circulars.issue");
        set((s) => ({ circulars: s.circulars.filter((c) => c.id !== id) }));
      },

      saveNotice: (n) => {
        assertCan("notices.publish");
        set((s) => ({ notices: upsert(s.notices, n) }));
      },
      deleteNotice: (id) => {
        assertCan("notices.publish");
        set((s) => ({ notices: s.notices.filter((n) => n.id !== id) }));
      },

      saveVisit: (v) => {
        assertCan("visits.create");
        const sess = session();
        // o morador só gere autorizações da sua própria fracção
        const existing = get().visits.find((x) => x.id === v.id);
        if (v.residentId !== sess?.residentId || (existing && existing.residentId !== sess?.residentId)) throw new PermissionError("visits.create");
        const isNew = !existing;
        set((s) => ({
          visits: upsert(s.visits, v),
          notifications: isNew
            ? [
                {
                  id: uid("ntf"),
                  title: v.kind === "grupo" ? "Nova visita de grupo autorizada" : "Nova visita autorizada",
                  body: v.kind === "grupo" ? `${v.eventName} — ${v.guests.length} convidados` : v.guests[0]?.name ?? "",
                  at: new Date().toISOString(),
                  read: false,
                  roles: ["porteiro"],
                  href: "/painel/portaria",
                },
                ...s.notifications,
              ]
            : s.notifications,
        }));
      },
      cancelVisit: (id) => {
        assertCan("visits.create");
        const v = get().visits.find((x) => x.id === id);
        if (!v || v.residentId !== session()?.residentId) throw new PermissionError("visits.create");
        set((s) => ({ visits: s.visits.map((x) => (x.id === id ? { ...x, status: "cancelada", updatedAt: new Date().toISOString() } : x)) }));
      },

      checkGuest: (visitId, guestId, type) => {
        // a Portaria confirma entrada/saída SEM alterar a autorização original
        assertCan("visits.check");
        const s = get();
        const visit = s.visits.find((v) => v.id === visitId);
        const guest = visit?.guests.find((g) => g.id === guestId);
        if (!visit || !guest || visit.status !== "autorizada") throw new Error("Autorização inexistente ou cancelada.");
        const presence = guestPresence(s.visitChecks, visitId, guestId);
        if (type === "entrada" && presence === "no_interior") throw new Error("A entrada já foi confirmada.");
        if (type === "saida" && presence !== "no_interior") throw new Error("Só é possível registar a saída após a entrada.");
        const now = new Date().toISOString();
        const by = session()?.name ?? "Portaria";
        set({
          visitChecks: [...s.visitChecks, { id: uid("chk"), visitId, guestId, type, at: now, by }],
          accessLogs: [{ id: uid("acc"), at: now, type, person: guest.name, category: "visitante", apartmentId: visit.apartmentId, gate: "Entrada principal" }, ...s.accessLogs],
        });
      },

      saveOccurrence: (o) => {
        assertCan("occurrences.manage");
        set((s) => ({ occurrences: upsert(s.occurrences, o) }));
      },

      reportOccurrence: (input) => {
        assertCan("occurrences.report");
        const sess = session()!;
        const s = get();
        const resident = s.residents.find((r) => r.id === sess.residentId);
        const apt = s.apartments.find((a) => a.id === resident?.apartmentId);
        const now = new Date().toISOString();
        const occ: Occurrence = {
          ...input,
          id: uid("oc"),
          priority: "media",
          status: "aberta",
          block: apt?.block,
          apartmentId: apt?.id,
          residentId: resident?.id,
          createdAt: now,
          reportedBy: sess.name,
          history: [{ id: uid("oh"), at: now, by: sess.name, role: sess.role, text: sess.role === "morador" ? "Ocorrência submetida pelo morador." : "Ocorrência registada.", status: "aberta" }],
        };
        set({
          occurrences: [occ, ...s.occurrences],
          notifications: [
            { id: uid("ntf"), title: "Nova ocorrência", body: `${occ.category} — ${occ.title}${apt ? ` (Bloco ${apt.block} · ${apt.number})` : ""}`, at: now, read: false, roles: ["gestor"], href: "/painel/ocorrencias" },
            ...s.notifications,
          ],
        });
        return occ;
      },

      updateOccurrence: (id, patch, note) => {
        assertCan("occurrences.manage");
        const sess = session()!;
        const now = new Date().toISOString();
        set((s) => ({
          occurrences: s.occurrences.map((o) => {
            if (o.id !== id) return o;
            const changes: string[] = [];
            if (patch.status && patch.status !== o.status) changes.push(`Estado: ${patch.status.replace("_", " ")}`);
            if (patch.assignee !== undefined && patch.assignee !== o.assignee) changes.push(`Responsável: ${patch.assignee || "—"}`);
            if (patch.priority && patch.priority !== o.priority) changes.push(`Prioridade: ${patch.priority}`);
            const ev: OccurrenceEvent = { id: uid("oh"), at: now, by: sess.name, role: sess.role, text: [changes.join(" · "), note].filter(Boolean).join(" — ") || "Actualização.", status: patch.status };
            const resolved = patch.status === "resolvida" && o.status !== "resolvida";
            return { ...o, ...patch, resolvedAt: resolved ? now : patch.status && patch.status !== "resolvida" ? undefined : o.resolvedAt, history: [...o.history, ev] };
          }),
        }));
      },

      addOccurrenceNote: (id, text) => {
        assertCan("occurrences.supervise");
        const sess = session()!;
        set((s) => ({
          occurrences: s.occurrences.map((o) =>
            o.id === id ? { ...o, history: [...o.history, { id: uid("oh"), at: new Date().toISOString(), by: sess.name, role: sess.role, text: sess.role === "administrador" ? `Supervisão: ${text}` : text }] } : o,
          ),
        }));
      },

      saveElevator: (e) => {
        assertCan("elevators.manage");
        set((s) => ({ elevators: upsert(s.elevators, e) }));
      },
      deleteElevator: (id) => {
        assertCan("elevators.manage");
        set((s) => ({ elevators: s.elevators.filter((e) => e.id !== id) }));
      },

      setElevatorStatus: (id, status, input) => {
        assertCan("elevators.manage");
        const sess = session()!;
        const s = get();
        const elv = s.elevators.find((e) => e.id === id);
        if (!elv) throw new Error("Elevador inexistente.");
        const now = new Date().toISOString();
        const today = todayISO();
        let occurrences = s.occurrences;
        let notifications = s.notifications;
        // avaria → cria ocorrência ligada (mesma fonte de dados para os dois dashboards)
        if (status === "avariado" && input.createOccurrence) {
          const occ: Occurrence = {
            id: uid("oc"),
            title: `Elevador ${elv.code} avariado`,
            description: input.description,
            category: "Elevadores",
            priority: "urgente",
            status: "aberta",
            block: elv.block,
            location: `Bloco ${elv.block} — elevador`,
            elevatorId: elv.id,
            assignee: elv.provider,
            createdAt: now,
            reportedBy: sess.name,
            history: [{ id: uid("oh"), at: now, by: sess.name, role: sess.role, text: "Avaria registada no módulo Elevadores.", status: "aberta" }],
          };
          occurrences = [occ, ...occurrences];
          notifications = [
            { id: uid("ntf"), title: `Elevador avariado — Bloco ${elv.block}`, body: input.description, at: now, read: false, roles: ["administrador", "gestor"], href: "/painel/elevadores" },
            ...notifications,
          ];
        }
        // reposição em funcionamento → resolve ocorrências de elevador em aberto
        if (status === "operacional") {
          occurrences = occurrences.map((o) =>
            o.elevatorId === id && o.status !== "resolvida"
              ? { ...o, status: "resolvida", resolvedAt: now, resolution: input.description, history: [...o.history, { id: uid("oh"), at: now, by: sess.name, role: sess.role, text: `Resolvida no módulo Elevadores: ${input.description}`, status: "resolvida" }] }
              : o,
          );
        }
        set({
          occurrences,
          notifications,
          elevators: s.elevators.map((e) =>
            e.id === id
              ? {
                  ...e,
                  status,
                  lastMaintenance: input.type === "manutencao" || input.type === "intervencao" ? today : e.lastMaintenance,
                  history: [...e.history, { id: uid("elh"), at: now, by: sess.name, type: input.type, description: input.description, status }],
                }
              : e,
          ),
        });
      },

      saveOpsTask: (t) => {
        assertCan("operations.manage");
        set((s) => ({ opsTasks: upsert(s.opsTasks, t) }));
      },
      deleteOpsTask: (id) => {
        assertCan("operations.manage");
        set((s) => ({ opsTasks: s.opsTasks.filter((t) => t.id !== id) }));
      },

      addDocument: (d) => {
        assertCan("documents.manage");
        set((s) => ({ documents: [d, ...s.documents] }));
      },
      deleteDocument: (id) => {
        assertCan("documents.manage");
        set((s) => ({ documents: s.documents.filter((d) => d.id !== id) }));
      },

      markNotificationsRead: (ids) =>
        set((s) => ({ notifications: s.notifications.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)) })),

      resetDemo: () => set(initialAll()),
    }),
    {
      name: "laguna-demo-data",
      version: 5,
      storage: safeStorage,
      migrate: () => initialAll() as DemoData & DemoActions,
      partialize: (s) => ({
        ...s,
        payments: s.payments.map((p) =>
          p.proof?.dataUrl && p.proof.dataUrl.length > MAX_PERSISTED_FILE ? { ...p, proof: { ...p.proof, dataUrl: undefined } } : p,
        ),
        notices: s.notices.map((n) => (n.pdf?.dataUrl && n.pdf.dataUrl.length > MAX_PERSISTED_FILE ? { ...n, pdf: { ...n.pdf, dataUrl: undefined } } : n)),
        reservations: s.reservations.map((r) =>
          r.payment?.proof?.dataUrl && r.payment.proof.dataUrl.length > MAX_PERSISTED_FILE ? { ...r, payment: { ...r.payment, proof: { ...r.payment.proof, dataUrl: undefined } } } : r,
        ),
        moveOuts: s.moveOuts.map((m) =>
          m.operational.report?.dataUrl && m.operational.report.dataUrl.length > MAX_PERSISTED_FILE ? { ...m, operational: { ...m.operational, report: { ...m.operational.report, dataUrl: undefined } } } : m,
        ),
      }),
      // quotas pendentes que ultrapassaram a data limite passam a "Em atraso"
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const today = todayISO();
        if (state.quotas.some((q) => q.status === "pendente" && q.dueDate < today)) {
          useDemoStore.setState({ quotas: state.quotas.map((q) => (q.status === "pendente" && q.dueDate < today ? { ...q, status: "em_atraso" } : q)) });
        }
      },
    },
  ),
);

/** Etiqueta legível de uma fracção: "Bloco 06 · 201". */
export function formatApt(a: Pick<Apartment, "block" | "number">) {
  return `Bloco ${a.block} · ${a.number}`;
}

/** Lookup rápido de apartamento → etiqueta legível. */
export function aptLabel(apartments: Apartment[], id?: string) {
  if (!id) return "—";
  const a = apartments.find((x) => x.id === id);
  if (a) return formatApt(a);
  const [, block, number] = id.split("_");
  return block && number ? `Bloco ${block} · ${number}` : id;
}

/** Promove o primeiro pedido em espera quando uma data volta a ficar livre. */
function promoteWaitlist(reservations: Reservation[], hallId: string, date: string, holdHours: number): Reservation[] {
  if (reservations.some((r) => r.hallId === hallId && r.date === date && BLOCKING_RESERVATION.includes(r.status))) return reservations;
  const next = reservations.filter((r) => r.hallId === hallId && r.date === date && r.status === "em_espera").sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (!next) return reservations;
  const now = new Date();
  return reservations.map((r) =>
    r.id === next.id ? { ...r, status: "pendente_pagamento", expiresAt: addH(now, holdHours), history: [...r.history, { id: uid("rh"), at: now.toISOString(), by: "Sistema", text: "Data libertada — pedido promovido da lista de espera.", status: "pendente_pagamento" }] } : r,
  );
}

/** Conta corrente da fracção no período de ocupação do morador do processo. */
export function accountFor(s: Pick<DemoData, "quotas" | "payments" | "charges" | "reservations" | "occupancies">, m: Pick<MoveOut, "apartmentId" | "residentId">) {
  const occupancy = s.occupancies.find((o) => o.apartmentId === m.apartmentId && o.residentId === m.residentId);
  return computeAccount({ apartmentId: m.apartmentId, quotas: s.quotas, payments: s.payments, charges: s.charges, reservations: s.reservations, occupancy });
}

/** Estado do processo de desocupação a partir das verificações. */
function nextMoveOutStatus(m: Pick<MoveOut, "financial" | "operational" | "status">): MoveOutStatus {
  if (m.status === "autorizada" || m.status === "concluida" || m.status === "cancelada") return m.status;
  if (m.financial.status === "regularizacao_pendente") return "regularizacao_pendente";
  if (m.financial.status === "regularizada" && m.operational.status === "concluida") return "aguardando_aprovacao";
  if (m.financial.status === "regularizada") return "em_verificacao_operacional";
  if (m.operational.status === "concluida") return "em_verificacao_financeira";
  return m.financial.status === "pendente" && m.status === "solicitacao_recebida" && !m.operational.at ? "solicitacao_recebida" : "em_verificacao_financeira";
}
