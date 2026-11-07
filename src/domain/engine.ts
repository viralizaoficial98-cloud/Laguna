/**
 * MOTOR DE DOMÍNIO do Portal Residencial Laguna — partilhado entre cliente e servidor.
 *
 * Contém o estado de negócio (DemoData) e todas as acções com as regras e as verificações de
 * permissão (src/config/permissions.ts). No servidor, as acções são executadas dentro de uma
 * transacção MySQL com a sessão autenticada (fonte de verdade); no cliente, são executadas de forma
 * optimista para resposta imediata e depois confirmadas pelo servidor.
 *
 * As acções são síncronas e não dependem de React. A sessão, o gerador de identificadores e o
 * relógio são injectados por `runWithContext`.
 */
import type {
  Session,
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
  PaymentMethod,
  Supplier,
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
import { parseQuarter, quarterOf, todayISO, uid } from "@/lib/utils";

export interface DemoData {
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
  suppliers: Supplier[];
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

export interface DemoActions {
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
  /**
   * Pagamento registado pela gestão em nome do morador (presencial, transferência, numerário…).
   * Comprovativo facultativo; `validate` aprova de imediato (com recibo) quando o perfil pode validar;
   * caso contrário fica Em Validação. `clientKey` impede duplicações por reenvio ou clique repetido.
   */
  registerPayment: (input: {
    quotaId: string;
    amount: number;
    method: Payment["method"];
    reference?: string;
    paidAt: string;
    note?: string;
    proof?: PaymentProof;
    validate?: boolean;
    clientKey?: string;
  }) => Payment;
  addExpense: (e: Omit<Expense, "id" | "period">) => Expense;
  updateExpense: (id: string, patch: Partial<Omit<Expense, "id" | "period" | "payments" | "paidAmount" | "history">>, note?: string) => void;
  approveExpense: (id: string) => void;
  payExpense: (id: string, p: { date: string; amount: number; method?: PaymentMethod; reference?: string }) => void;
  voidExpense: (id: string, reason: string) => void;
  deleteExpense: (id: string) => void;
  saveSupplier: (s: Supplier) => Supplier;
  archiveSupplier: (id: string, archived: boolean) => void;
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

export function initialData(): DemoData {
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
    suppliers: [],
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

/** Estado vazio (antes de os dados serem carregados do servidor). */
export function emptyData(): DemoData {
  return {
    settings: DEFAULT_SETTINGS,
    apartments: [],
    residents: [],
    quotas: [],
    payments: [],
    circulars: [],
    notices: [],
    visits: [],
    visitChecks: [],
    occurrences: [],
    elevators: [],
    opsTasks: [],
    expenses: [],
    suppliers: [],
    accessLogs: [],
    documents: [],
    notifications: [],
    halls: [],
    reservations: [],
    charges: [],
    occupancies: [],
    moveOuts: [],
    audit: [],
  };
}

/** Colecções do estado de negócio (todas as chaves de DemoData excepto `settings`). */
export const COLLECTIONS = [
  "apartments",
  "residents",
  "quotas",
  "payments",
  "circulars",
  "notices",
  "visits",
  "visitChecks",
  "occurrences",
  "elevators",
  "opsTasks",
  "expenses",
  "suppliers",
  "accessLogs",
  "documents",
  "notifications",
  "halls",
  "reservations",
  "charges",
  "occupancies",
  "moveOuts",
  "audit",
] as const satisfies readonly Exclude<keyof DemoData, "settings">[];
export type CollectionName = (typeof COLLECTIONS)[number];

export function initialAll(): DemoData {
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

type Ctx = { session: () => Session | null; seed?: string; counter: number };
let defaultSession: () => Session | null = () => null;
let ctx: Ctx | null = null;

/** Fornecedor de sessão por omissão (cliente: sessão autenticada no browser). */
export function setDefaultSessionProvider(fn: () => Session | null) {
  defaultSession = fn;
}

/**
 * Executa `fn` (síncrona) com a sessão e uma semente de identificadores. A mesma semente produz os
 * mesmos identificadores no cliente (execução optimista) e no servidor (execução autoritativa).
 */
export function runWithContext<T>(c: { session?: Session | null; seed?: string }, fn: () => T): T {
  const prev = ctx;
  const sess = c.session === undefined ? undefined : c.session;
  ctx = { session: sess === undefined ? () => defaultSession() : () => sess, seed: c.seed, counter: 0 };
  try {
    return fn();
  } finally {
    ctx = prev;
  }
}

function session() {
  return ctx ? ctx.session() : defaultSession();
}

/** Identificador: determinístico quando existe semente (cliente e servidor coincidem). */
function nid(prefix: string) {
  if (ctx?.seed) {
    ctx.counter += 1;
    return `${prefix}_${ctx.seed}${ctx.counter.toString(36)}`;
  }
  return uid(prefix);
}

/** Verificação de permissão ao nível da operação (não apenas da interface). */
function assertCan(permission: Permission) {
  if (!can(session()?.role, permission)) throw new PermissionError(permission);
}

function audit(action: string, entity: string, entityId: string, details?: string): AuditEntry {
  const sess = session();
  return { id: nid("aud"), at: new Date().toISOString(), by: sess?.name ?? "Sistema", role: sess?.role ?? "administrador", action, entity, entityId, details };
}

function notif(title: string, body: string, roles: AppNotification["roles"], href?: string, residentId?: string): AppNotification {
  return { id: nid("ntf"), title, body, at: new Date().toISOString(), read: false, roles, href, ...(residentId ? { residentId } : {}) };
}

let receiptSeq = 0;
function receiptNumber(prefix = "REC") {
  const year = new Date().getFullYear();
  if (ctx?.seed) {
    ctx.counter += 1;
    return `${prefix}-${year}-${ctx.seed.slice(0, 6).toUpperCase()}${ctx.counter}`;
  }
  receiptSeq += 1;
  return `${prefix}-${year}-${String(Date.now()).slice(-5)}${receiptSeq}`;
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


export type DomainSet = (p: Partial<DemoData> | ((s: DemoData) => Partial<DemoData>)) => void;
export type DomainGet = () => DemoData;

/** Cria as acções sobre um estado (store zustand no cliente ou estado carregado da base de dados no servidor). */
export function createActions(set: DomainSet, get: DomainGet): DemoActions {
  const self: DemoActions = {

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
        // fracção e morador vêm da quota e da sessão (nunca dos dados enviados pelo cliente)
        const payment: Payment = { ...input, apartmentId: quota.apartmentId, residentId: resident!.id, id: nid("pay"), status: "em_analise", submittedAt: new Date().toISOString() };
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
              payment.residentId,
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
        // reenvio do mesmo formulário (duplo clique, ligação lenta) → recusado, sem novo pagamento
        if (input.clientKey && s.payments.some((p) => p.clientKey === input.clientKey)) throw new Error("Este pagamento já foi registado (pedido repetido).");
        const quota = s.quotas.find((q) => q.id === input.quotaId);
        if (!quota) throw new Error("Seleccione a fracção e a quota.");
        if (s.payments.some((p) => p.quotaId === quota.id && p.status === "em_analise")) throw new Error("Existe um comprovativo em validação para esta quota — decida-o primeiro.");
        const remaining = Math.round((quota.amount - quota.paidAmount) * 100) / 100;
        if (remaining <= 0) throw new Error("Esta quota já se encontra paga.");
        if (!(input.amount > 0) || input.amount > remaining) throw new Error(`Valor inválido. Montante em dívida nesta quota: ${remaining.toLocaleString("pt-AO")} Kz.`);
        if (input.amount < remaining && !s.settings.allowPartial) throw new Error("Os pagamentos parciais não estão autorizados.");
        if (!input.paidAt || input.paidAt.slice(0, 10) > todayISO()) throw new Error("Indique uma data de pagamento válida (não futura).");
        const approve = input.validate !== false && can(sess.role, "payments.review");
        const now = new Date().toISOString();
        const apt = s.apartments.find((a) => a.id === quota.apartmentId);
        const payment: Payment = {
          id: nid("pay"),
          quotaId: quota.id,
          apartmentId: quota.apartmentId,
          residentId: apt?.residentId,
          amount: input.amount,
          method: input.method,
          reference: (input.reference ?? "").trim(),
          paidAt: `${input.paidAt.slice(0, 10)}T12:00:00`,
          submittedAt: now,
          proof: input.proof,
          status: approve ? "aprovado" : "em_analise",
          ...(approve ? { reviewedBy: sess.name, reviewedByRole: sess.role, reviewedAt: now, validatedAmount: input.amount, receiptNumber: receiptNumber() } : {}),
          registeredBy: sess.name,
          submittedBy: sess.name,
          channel: "presencial",
          clientKey: input.clientKey,
          note: input.note?.trim() || undefined,
        };
        const payments = [payment, ...s.payments];
        const recomputed = quotaStatusFrom(quota, payments.filter((p) => p.quotaId === quota.id));
        set({
          payments,
          quotas: s.quotas.map((q) => (q.id === quota.id ? { ...q, ...recomputed, paymentId: payment.id } : q)),
          notifications: approve
            ? [notif("Pagamento registado pela gestão", `${quota.description} — ${input.amount.toLocaleString("pt-AO")} Kz · recibo ${payment.receiptNumber}`, ["morador"], "/painel/minhas-quotas", payment.residentId), ...s.notifications]
            : [notif("Pagamento presencial para validação", `${apt ? `Bloco ${apt.block} · ${apt.number}` : ""} · ${quota.description} · ${input.amount.toLocaleString("pt-AO")} Kz${input.proof ? "" : " · sem comprovativo"}`, ["gestor", "financeiro"], "/painel/pagamentos"), ...s.notifications],
          audit: [audit(approve ? "Pagamento presencial registado e validado" : "Pagamento presencial registado (em validação)", "payment", payment.id, `${quota.description} · ${input.amount} Kz · ${input.method}${input.proof ? ` · comprovativo ${input.proof.name}` : " · sem comprovativo"}`), ...s.audit],
        });
        return payment;
      },

      addExpense: (e) => {
        assertCan("expenses.manage");
        const sess = session()!;
        if (!e.description?.trim() || !(e.amount > 0)) throw new Error("Indique a descrição e o valor da despesa.");
        if (!e.date) throw new Error("Indique a data da despesa.");
        const s = get();
        if (e.invoiceRef && (e.supplierId || e.nif) && s.expenses.some((x) => x.status !== "anulada" && x.invoiceRef === e.invoiceRef && ((e.supplierId && x.supplierId === e.supplierId) || (e.nif && x.nif === e.nif))))
          throw new Error(`Já existe uma despesa com a factura ${e.invoiceRef} deste fornecedor.`);
        const vat = e.vat ?? 0;
        const withholding = e.withholding ?? 0;
        const now = new Date().toISOString();
        const exp: Expense = {
          ...e,
          id: nid("exp"),
          period: quarterOf(e.date),
          vat,
          withholding,
          netAmount: e.netAmount ?? Math.round((e.amount + vat - withholding) * 100) / 100,
          status: e.status ?? "pendente",
          paidAmount: e.paidAmount ?? (e.status === "paga" ? Math.round((e.amount + vat - withholding) * 100) / 100 : 0),
          createdBy: sess.name,
          history: [...(e.history ?? []), { at: now, by: sess.name, text: e.source ? `Importada de ${e.source.file} (linha ${e.source.row}).` : "Despesa registada." }],
        };
        set((st) => ({ expenses: [exp, ...st.expenses], audit: [audit("Despesa registada", "expense", exp.id, `${e.category} · ${e.amount} Kz${e.invoiceRef ? ` · ${e.invoiceRef}` : ""}`), ...st.audit] }));
        return exp;
      },
      updateExpense: (id, patch, note) => {
        assertCan("expenses.manage");
        const sess = session()!;
        const s = get();
        const cur = s.expenses.find((x) => x.id === id);
        if (!cur) throw new Error("Despesa inexistente.");
        if (cur.status === "anulada") throw new Error("Despesa anulada — não pode ser alterada.");
        const next: Expense = { ...cur, ...patch, id, period: quarterOf(patch.date ?? cur.date) };
        if (!(next.amount > 0)) throw new Error("O valor da despesa deve ser positivo.");
        next.netAmount = patch.netAmount ?? Math.round((next.amount + (next.vat ?? 0) - (next.withholding ?? 0)) * 100) / 100;
        const changed = Object.keys(patch).filter((k) => JSON.stringify((cur as unknown as Record<string, unknown>)[k]) !== JSON.stringify((patch as Record<string, unknown>)[k]));
        next.history = [...(cur.history ?? []), { at: new Date().toISOString(), by: sess.name, text: `Corrigida: ${changed.join(", ") || "sem alterações"}${note ? ` — ${note}` : ""}` }];
        set({ expenses: s.expenses.map((x) => (x.id === id ? next : x)), audit: [audit("Despesa corrigida", "expense", id, changed.map((k) => `${k}: ${JSON.stringify((cur as unknown as Record<string, unknown>)[k])} → ${JSON.stringify((patch as Record<string, unknown>)[k])}`).join("; ").slice(0, 900)), ...s.audit] });
      },
      approveExpense: (id) => {
        assertCan("expenses.manage");
        const sess = session()!;
        const s = get();
        const cur = s.expenses.find((x) => x.id === id);
        if (!cur || cur.status !== "pendente") throw new Error("Só é possível aprovar despesas pendentes.");
        set({
          expenses: s.expenses.map((x) => (x.id === id ? { ...x, status: "aprovada", history: [...(x.history ?? []), { at: new Date().toISOString(), by: sess.name, text: "Despesa aprovada." }] } : x)),
          audit: [audit("Despesa aprovada", "expense", id), ...s.audit],
        });
      },
      payExpense: (id, p) => {
        assertCan("expenses.manage");
        const sess = session()!;
        const s = get();
        const cur = s.expenses.find((x) => x.id === id);
        if (!cur) throw new Error("Despesa inexistente.");
        if (cur.status === "anulada" || cur.status === "paga" || !cur.status) throw new Error("Esta despesa não está por pagar.");
        const due = Math.round(((cur.netAmount ?? cur.amount) - (cur.paidAmount ?? 0)) * 100) / 100;
        if (!(p.amount > 0) || p.amount > due + 0.005) throw new Error(`Valor inválido. Em falta: ${due.toLocaleString("pt-AO")} Kz.`);
        const now = new Date().toISOString();
        const paidAmount = Math.round(((cur.paidAmount ?? 0) + p.amount) * 100) / 100;
        const status = paidAmount >= (cur.netAmount ?? cur.amount) - 0.005 ? "paga" : "parcialmente_paga";
        set({
          expenses: s.expenses.map((x) =>
            x.id === id
              ? {
                  ...x,
                  paidAmount,
                  status,
                  paymentDate: p.date,
                  payments: [...(x.payments ?? []), { id: nid("xpp"), date: p.date, amount: p.amount, method: p.method, reference: p.reference, by: sess.name, at: now }],
                  history: [...(x.history ?? []), { at: now, by: sess.name, text: `Pagamento de ${p.amount.toLocaleString("pt-AO")} Kz (${status === "paga" ? "liquidada" : "parcial"}).` }],
                }
              : x,
          ),
          audit: [audit("Pagamento de despesa", "expense", id, `${p.amount} Kz · ${p.date}`), ...s.audit],
        });
      },
      voidExpense: (id, reason) => {
        assertCan("expenses.manage");
        if (!reason?.trim()) throw new Error("Indique o motivo da anulação.");
        const sess = session()!;
        const s = get();
        const cur = s.expenses.find((x) => x.id === id);
        if (!cur || cur.status === "anulada") throw new Error("Despesa inexistente ou já anulada.");
        set({
          expenses: s.expenses.map((x) => (x.id === id ? { ...x, status: "anulada", voidReason: reason.trim(), history: [...(x.history ?? []), { at: new Date().toISOString(), by: sess.name, text: `Anulada: ${reason.trim()}` }] } : x)),
          audit: [audit("Despesa anulada", "expense", id, reason.trim()), ...s.audit],
        });
      },
      deleteExpense: (id) => {
        assertCan("expenses.manage");
        const cur = get().expenses.find((x) => x.id === id);
        // registos financeiros com pagamentos ou já pagos são anulados, nunca apagados
        if (!cur) throw new Error("Despesa inexistente.");
        if (!cur.status || cur.status === "paga" || cur.status === "parcialmente_paga" || (cur.payments ?? []).length) throw new Error("Despesas pagas não podem ser eliminadas — utilize Anular.");
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id), audit: [audit("Despesa eliminada", "expense", id, `${cur.description} · ${cur.amount} Kz`), ...s.audit] }));
      },

      saveSupplier: (sup) => {
        assertCan("suppliers.manage");
        const sess = session()!;
        if (!sup.name?.trim()) throw new Error("Indique o nome do fornecedor.");
        const s = get();
        const nif = sup.nif?.trim() || undefined;
        if (nif && s.suppliers.some((x) => x.id !== sup.id && x.nif === nif)) throw new Error(`Já existe um fornecedor com o NIF ${nif}.`);
        const existing = s.suppliers.find((x) => x.id === sup.id);
        const now = new Date().toISOString();
        const next: Supplier = { ...sup, id: sup.id || nid("sup"), name: sup.name.trim(), nif, createdAt: existing?.createdAt ?? now, history: [...(existing?.history ?? []), { at: now, by: sess.name, text: existing ? "Fornecedor actualizado." : "Fornecedor registado." }] };
        set({ suppliers: upsert(s.suppliers, next), audit: [audit(existing ? "Fornecedor actualizado" : "Fornecedor registado", "supplier", next.id, next.name), ...s.audit] });
        return next;
      },
      archiveSupplier: (id, archived) => {
        assertCan("suppliers.manage");
        const sess = session()!;
        set((s) => ({
          suppliers: s.suppliers.map((x) => (x.id === id ? { ...x, active: !archived, history: [...(x.history ?? []), { at: new Date().toISOString(), by: sess.name, text: archived ? "Arquivado." : "Reactivado." }] } : x)),
          audit: [audit(archived ? "Fornecedor arquivado" : "Fornecedor reactivado", "supplier", id), ...s.audit],
        }));
      },

      saveHall: (h) => {
        assertCan("halls.manage");
        set((s) => ({ halls: upsert(s.halls, h) }));
      },

      requestReservation: (input, opts = {}) => {
        assertCan("reservations.request");
        self.expireReservations();
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
          id: nid("rsv"),
          residentId: resident.id,
          apartmentId: resident.apartmentId,
          fee: s.settings.reservationFee,
          status,
          createdAt: now.toISOString(),
          expiresAt: status === "pendente_pagamento" ? addH(now, s.settings.reservationHoldHours) : undefined,
          history: [{ id: nid("rh"), at: now.toISOString(), by: sess.name, text: status === "em_espera" ? "Pedido em lista de espera." : "Pedido de reserva — data bloqueada provisoriamente até ao pagamento.", status }],
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
            x.id === id ? { ...x, status: "em_validacao", payment: { reference: input.reference, proof: input.proof, submittedAt: now }, history: [...x.history, { id: nid("rh"), at: now, by: sess.name, text: "Comprovativo de pagamento enviado.", status: "em_validacao" }] } : x,
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
                  history: [...x.history, { id: nid("rh"), at: now.toISOString(), by: sess.name, text: decision === "aprovado" ? "Pagamento validado — reserva confirmada." : `Comprovativo rejeitado: ${note}`, status }],
                }
              : x,
          ),
          notifications: [notif(decision === "aprovado" ? "Reserva confirmada" : "Pagamento da reserva rejeitado", `${r.eventName} · ${r.date}${note ? ` — ${note}` : ""}`, ["morador"], "/painel/reservas", r.residentId), ...s.notifications],
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
        let reservations = s.reservations.map((x) => (x.id === id ? { ...x, status: "cancelada" as const, history: [...x.history, { id: nid("rh"), at: now.toISOString(), by: sess.name, text: `Reserva cancelada${reason ? `: ${reason}` : ""}.`, status: "cancelada" as const }] } : x));
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
          expired.some((e) => e.id === r.id) ? { ...r, status: "expirada" as const, history: [...r.history, { id: nid("rh"), at: now.toISOString(), by: "Sistema", text: "Reserva provisória expirada por falta de pagamento.", status: "expirada" as const }] } : r,
        );
        expired.forEach((e) => (reservations = promoteWaitlist(reservations, e.hallId, e.date, s.settings.reservationHoldHours)));
        set({ reservations, audit: [...expired.map((e) => ({ ...audit("Reserva expirada", "reservation", e.id), by: "Sistema" })), ...s.audit] });
        return expired.length;
      },

      proposeCharge: (c) => {
        assertCan("charges.propose");
        if (!c.justification.trim() || c.amount <= 0) throw new Error("O encargo exige fundamentação e valor.");
        const sess = session()!;
        const charge: Charge = { ...c, id: nid("chg"), date: todayISO(), status: "proposto", proposedBy: sess.name };
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
          id: nid("mov"),
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
          history: [{ id: nid("mh"), at: now, by: resident.name, text: "Solicitação de desocupação submetida.", status: "solicitacao_recebida" }],
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
              ? { ...x, financial, status, history: [...x.history, { id: nid("mh"), at: now, by: sess.name, text: ok ? "Verificação financeira: situação regularizada." : `Verificação financeira: Regularização Financeira Pendente (${(acc.confirmedDebt + acc.inValidation).toLocaleString("pt-AO")} Kz).`, status }] }
              : x,
          ),
          notifications: ok ? s.notifications : [notif("Regularização Financeira Pendente", `Processo ${m.reference}: existem valores em aberto. Consulte a conta corrente.`, ["morador"], "/painel/desocupacao", m.residentId), ...s.notifications],
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
          moveOuts: s.moveOuts.map((x) => (x.id === id ? { ...x, operational, status, history: [...x.history, { id: nid("mh"), at: now, by: sess.name, text: input.conclude ? "Verificação operacional concluída." : "Verificação operacional actualizada.", status }] } : x)),
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
            x.id === id ? { ...x, status: "autorizada", authorization: { by: sess.name, role: sess.role, at: now, notes }, history: [...x.history, { id: nid("mh"), at: now, by: sess.name, text: "Autorização administrativa de saída emitida.", status: "autorizada" }] } : x,
          ),
          notifications: [notif("Saída autorizada", `Processo ${m.reference} — Bloco ${m.block} · ${m.number}`, ["morador", "porteiro", "administrador"], "/painel/desocupacao", m.residentId), ...s.notifications],
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
          moveOuts: s.moveOuts.map((x) => (x.id === id ? { ...x, status: "concluida", completedAt: now, history: [...x.history, { id: nid("mh"), at: now, by: sess.name, text: "Desocupação concluída — fracção disponível.", status: "concluida" }] } : x)),
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
          moveOuts: s.moveOuts.map((x) => (x.id === id ? { ...x, status: "cancelada", history: [...x.history, { id: nid("mh"), at: now, by: sess.name, text: `Processo cancelado${reason ? `: ${reason}` : ""}.`, status: "cancelada" }] } : x)),
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
                  id: nid("ntf"),
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
          visitChecks: [...s.visitChecks, { id: nid("chk"), visitId, guestId, type, at: now, by }],
          accessLogs: [{ id: nid("acc"), at: now, type, person: guest.name, category: "visitante", apartmentId: visit.apartmentId, gate: "Entrada principal" }, ...s.accessLogs],
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
          id: nid("oc"),
          priority: "media",
          status: "aberta",
          block: apt?.block,
          apartmentId: apt?.id,
          residentId: resident?.id,
          createdAt: now,
          reportedBy: sess.name,
          history: [{ id: nid("oh"), at: now, by: sess.name, role: sess.role, text: sess.role === "morador" ? "Ocorrência submetida pelo morador." : "Ocorrência registada.", status: "aberta" }],
        };
        set({
          occurrences: [occ, ...s.occurrences],
          notifications: [
            { id: nid("ntf"), title: "Nova ocorrência", body: `${occ.category} — ${occ.title}${apt ? ` (Bloco ${apt.block} · ${apt.number})` : ""}`, at: now, read: false, roles: ["gestor"], href: "/painel/ocorrencias" },
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
            const ev: OccurrenceEvent = { id: nid("oh"), at: now, by: sess.name, role: sess.role, text: [changes.join(" · "), note].filter(Boolean).join(" — ") || "Actualização.", status: patch.status };
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
            o.id === id ? { ...o, history: [...o.history, { id: nid("oh"), at: new Date().toISOString(), by: sess.name, role: sess.role, text: sess.role === "administrador" ? `Supervisão: ${text}` : text }] } : o,
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
            id: nid("oc"),
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
            history: [{ id: nid("oh"), at: now, by: sess.name, role: sess.role, text: "Avaria registada no módulo Elevadores.", status: "aberta" }],
          };
          occurrences = [occ, ...occurrences];
          notifications = [
            { id: nid("ntf"), title: `Elevador avariado — Bloco ${elv.block}`, body: input.description, at: now, read: false, roles: ["administrador", "gestor"], href: "/painel/elevadores" },
            ...notifications,
          ];
        }
        // reposição em funcionamento → resolve ocorrências de elevador em aberto
        if (status === "operacional") {
          occurrences = occurrences.map((o) =>
            o.elevatorId === id && o.status !== "resolvida"
              ? { ...o, status: "resolvida", resolvedAt: now, resolution: input.description, history: [...o.history, { id: nid("oh"), at: now, by: sess.name, role: sess.role, text: `Resolvida no módulo Elevadores: ${input.description}`, status: "resolvida" }] }
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
                  history: [...e.history, { id: nid("elh"), at: now, by: sess.name, type: input.type, description: input.description, status }],
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

      markNotificationsRead: (ids) => {
        const userId = session()?.userId;
        set((s) => ({
          notifications: s.notifications.map((n) => (ids.includes(n.id) ? { ...n, read: true, readBy: userId && !(n.readBy ?? []).includes(userId) ? [...(n.readBy ?? []), userId] : n.readBy } : n)),
        }));
      },

      resetDemo: () => set(initialAll()),
  };
  return self;
}

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
    r.id === next.id ? { ...r, status: "pendente_pagamento", expiresAt: addH(now, holdHours), history: [...r.history, { id: nid("rh"), at: now.toISOString(), by: "Sistema", text: "Data libertada — pedido promovido da lista de espera.", status: "pendente_pagamento" }] } : r,
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
