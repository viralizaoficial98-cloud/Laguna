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
  AppNotification,
  Circular,
  CondoDocument,
  CondoSettings,
  GuestPresence,
  InternalNotice,
  Occurrence,
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
  seedOccurrences,
  seedVisitChecks,
  seedVisits,
} from "@/data/management";
import { can, PermissionError, type Permission } from "@/config/permissions";
import { useAuthStore } from "@/store/auth-store";
import { parseQuarter, todayISO, uid } from "@/lib/utils";

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
  accessLogs: AccessLog[];
  documents: CondoDocument[];
  notifications: AppNotification[];
}

interface DemoActions {
  saveApartment: (apt: Apartment) => void;
  deleteApartment: (id: string) => void;
  saveResident: (res: Resident) => void;
  deleteResident: (id: string) => void;
  updateSettings: (s: Partial<CondoSettings>) => void;
  /** Emite as quotas de um trimestre para todas as fracções activas ocupadas. Devolve o n.º emitido. */
  emitQuotas: (period: string) => number;
  submitPayment: (input: Omit<Payment, "id" | "status" | "submittedAt">) => Payment;
  reviewPayment: (paymentId: string, decision: "aprovado" | "rejeitado", reviewer: string, note?: string) => void;
  saveCircular: (c: Circular) => void;
  deleteCircular: (id: string) => void;
  saveNotice: (n: InternalNotice) => void;
  deleteNotice: (id: string) => void;
  saveVisit: (v: Visit) => void;
  cancelVisit: (id: string) => void;
  checkGuest: (visitId: string, guestId: string, type: "entrada" | "saida") => void;
  saveOccurrence: (o: Occurrence) => void;
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
    accessLogs: seedAccessLogs,
    documents: seedDocuments,
    notifications: seedNotifications,
  };
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
      ...initialData(),

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
        assertCan("quotas.manage");
        set((s) => ({ settings: { ...s.settings, ...patch } }));
      },

      emitQuotas: (period) => {
        assertCan("quotas.manage");
        const s = get();
        const { year, quarter } = parseQuarter(period);
        const existing = new Set(s.quotas.filter((q) => q.period === period).map((q) => q.apartmentId));
        const dueDate = quotaDueDate(period, s.settings.dueDay);
        const created: Quota[] = s.apartments
          .filter((a) => a.active && a.status === "ocupado" && !existing.has(a.id))
          .map((a) => ({
            id: `quo_${a.id}_${period}`,
            apartmentId: a.id,
            period,
            year,
            quarter,
            description: quotaDescription(period),
            amount: s.settings.quarterlyQuota,
            dueDate,
            status: unpaidStatus({ dueDate }),
          }));
        set({ quotas: [...s.quotas, ...created] });
        return created.length;
      },

      submitPayment: (input) => {
        assertCan("payments.submit");
        const payment: Payment = { ...input, id: uid("pay"), status: "em_analise", submittedAt: new Date().toISOString() };
        set((s) => ({
          payments: [payment, ...s.payments.filter((p) => p.quotaId !== input.quotaId || p.status === "aprovado")],
          quotas: s.quotas.map((q) => (q.id === input.quotaId ? { ...q, status: "em_analise", paymentId: payment.id } : q)),
          notifications: [
            {
              id: uid("ntf"),
              title: "Novo comprovativo submetido",
              body: `Pagamento ${input.reference} aguarda validação.`,
              at: new Date().toISOString(),
              read: false,
              roles: ["admin_geral", "administrador", "financeiro"],
              href: "/painel/pagamentos",
            },
            ...s.notifications,
          ],
        }));
        return payment;
      },

      reviewPayment: (paymentId, decision, reviewer, note) => {
        assertCan("payments.review");
        set((s) => {
          const payment = s.payments.find((p) => p.id === paymentId);
          if (!payment) return {};
          const quota = s.quotas.find((q) => q.id === payment.quotaId);
          return {
            payments: s.payments.map((p) =>
              p.id === paymentId ? { ...p, status: decision, reviewedBy: reviewer, reviewedAt: new Date().toISOString(), note } : p,
            ),
            // rejeitado → a quota volta a Pendente / Em atraso, mantendo o histórico do comprovativo
            quotas: s.quotas.map((q) => (q.id === payment.quotaId ? { ...q, status: decision === "aprovado" ? "pago" : unpaidStatus(q) } : q)),
            notifications: [
              {
                id: uid("ntf"),
                title: decision === "aprovado" ? "Pagamento validado" : "Comprovativo rejeitado",
                body: `${quota?.description ?? "Quota"} — ${decision === "aprovado" ? "pagamento confirmado pela Administração." : note || "verifique o comprovativo."}`,
                at: new Date().toISOString(),
                read: false,
                roles: ["morador"],
                href: "/painel/minhas-quotas",
              },
              ...s.notifications,
            ],
          };
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

      resetDemo: () => set(initialData()),
    }),
    {
      name: "laguna-demo-data",
      version: 3,
      storage: safeStorage,
      migrate: () => initialData() as DemoData & DemoActions,
      partialize: (s) => ({
        ...s,
        payments: s.payments.map((p) =>
          p.proof?.dataUrl && p.proof.dataUrl.length > MAX_PERSISTED_FILE ? { ...p, proof: { ...p.proof, dataUrl: undefined } } : p,
        ),
        notices: s.notices.map((n) => (n.pdf?.dataUrl && n.pdf.dataUrl.length > MAX_PERSISTED_FILE ? { ...n, pdf: { ...n.pdf, dataUrl: undefined } } : n)),
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
