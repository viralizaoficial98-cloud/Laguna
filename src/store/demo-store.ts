"use client";

/**
 * Estado local da DEMONSTRAÇÃO.
 *
 * Funciona como um "repositório" em memória (persistido no localStorage do
 * browser) para que a interface possa ser testada sem backend. Na fase de
 * integração com MySQL/Prisma, cada acção aqui deverá chamar a API
 * correspondente (ver `src/services`) e actualizar o estado com a resposta.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  AccessLog,
  Apartment,
  AppNotification,
  Circular,
  CondoDocument,
  InternalNotice,
  Occurrence,
  Payment,
  Quota,
  Resident,
  Visitor,
} from "@/types";
import {
  createManagementSeed,
  seedAccessLogs,
  seedCirculars,
  seedDocuments,
  seedNotices,
  seedNotifications,
  seedOccurrences,
  seedVisitors,
} from "@/data/management";
import { uid } from "@/lib/utils";

interface DemoData {
  apartments: Apartment[];
  residents: Resident[];
  quotas: Quota[];
  payments: Payment[];
  circulars: Circular[];
  notices: InternalNotice[];
  visitors: Visitor[];
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
  submitPayment: (input: Omit<Payment, "id" | "status" | "submittedAt">) => Payment;
  reviewPayment: (paymentId: string, decision: "aprovado" | "rejeitado", reviewer: string, note?: string) => void;
  saveCircular: (c: Circular) => void;
  deleteCircular: (id: string) => void;
  saveNotice: (n: InternalNotice) => void;
  deleteNotice: (id: string) => void;
  saveVisitor: (v: Visitor) => void;
  checkoutVisitor: (id: string) => void;
  saveOccurrence: (o: Occurrence) => void;
  addDocument: (d: CondoDocument) => void;
  deleteDocument: (id: string) => void;
  markNotificationsRead: (ids: string[]) => void;
  resetDemo: () => void;
}

function initialData(): DemoData {
  return {
    ...createManagementSeed(),
    circulars: seedCirculars,
    notices: seedNotices,
    visitors: seedVisitors,
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

/** Evita exceder a quota do localStorage com pré-visualizações grandes. */
const MAX_PERSISTED_PROOF = 700_000;

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
    (set) => ({
      ...initialData(),

      saveApartment: (apt) =>
        set((s) => {
          // mantém a relação morador ↔ apartamento coerente
          const residents = s.residents.map((r) =>
            r.id === apt.residentId ? { ...r, apartmentId: apt.id } : r.apartmentId === apt.id && r.id !== apt.residentId ? { ...r, apartmentId: undefined } : r,
          );
          return { apartments: upsert(s.apartments, apt), residents };
        }),
      deleteApartment: (id) =>
        set((s) => ({
          apartments: s.apartments.filter((a) => a.id !== id),
          residents: s.residents.map((r) => (r.apartmentId === id ? { ...r, apartmentId: undefined } : r)),
        })),

      saveResident: (res) =>
        set((s) => {
          const apartments = s.apartments.map((a) => {
            if (a.id === res.apartmentId) return { ...a, residentId: res.id, status: "ocupado" as const };
            if (a.residentId === res.id && a.id !== res.apartmentId) return { ...a, residentId: undefined };
            return a;
          });
          return { residents: upsert(s.residents, res), apartments };
        }),
      deleteResident: (id) =>
        set((s) => ({
          residents: s.residents.filter((r) => r.id !== id),
          apartments: s.apartments.map((a) => (a.residentId === id ? { ...a, residentId: undefined } : a)),
        })),

      submitPayment: (input) => {
        const payment: Payment = { ...input, id: uid("pay"), status: "em_analise", submittedAt: new Date().toISOString() };
        set((s) => ({
          payments: [payment, ...s.payments.filter((p) => p.quotaId !== input.quotaId || p.status === "aprovado")],
          quotas: s.quotas.map((q) => (q.id === input.quotaId ? { ...q, status: "em_analise", paymentId: payment.id } : q)),
          notifications: [
            {
              id: uid("ntf"),
              title: "Novo comprovativo submetido",
              body: `Pagamento de ${input.reference} aguarda aprovação.`,
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

      reviewPayment: (paymentId, decision, reviewer, note) =>
        set((s) => {
          const payment = s.payments.find((p) => p.id === paymentId);
          if (!payment) return {};
          const quota = s.quotas.find((q) => q.id === payment.quotaId);
          return {
            payments: s.payments.map((p) =>
              p.id === paymentId ? { ...p, status: decision, reviewedBy: reviewer, reviewedAt: new Date().toISOString(), note } : p,
            ),
            quotas: s.quotas.map((q) => (q.id === payment.quotaId ? { ...q, status: decision } : q)),
            notifications: [
              {
                id: uid("ntf"),
                title: decision === "aprovado" ? "Pagamento aprovado" : "Pagamento rejeitado",
                body: `${quota?.description ?? "Quota"} — ${decision === "aprovado" ? "confirmado pela administração." : note || "verifique o comprovativo."}`,
                at: new Date().toISOString(),
                read: false,
                roles: ["morador"],
                href: "/painel/minhas-quotas",
              },
              ...s.notifications,
            ],
          };
        }),

      saveCircular: (c) => set((s) => ({ circulars: upsert(s.circulars, c) })),
      deleteCircular: (id) => set((s) => ({ circulars: s.circulars.filter((c) => c.id !== id) })),

      saveNotice: (n) => set((s) => ({ notices: upsert(s.notices, n) })),
      deleteNotice: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),

      saveVisitor: (v) =>
        set((s) => ({
          visitors: upsert(s.visitors, v),
          accessLogs:
            v.status === "no_interior" && !s.visitors.some((x) => x.id === v.id && x.status === "no_interior")
              ? [{ id: uid("acc"), at: new Date().toISOString(), type: "entrada", person: v.name, category: "visitante", apartmentId: v.apartmentId, gate: "Entrada principal" }, ...s.accessLogs]
              : s.accessLogs,
        })),
      checkoutVisitor: (id) =>
        set((s) => {
          const v = s.visitors.find((x) => x.id === id);
          if (!v) return {};
          const now = new Date().toISOString();
          return {
            visitors: s.visitors.map((x) => (x.id === id ? { ...x, status: "saiu", exitAt: now } : x)),
            accessLogs: [{ id: uid("acc"), at: now, type: "saida", person: v.name, category: "visitante", apartmentId: v.apartmentId, gate: "Entrada principal" }, ...s.accessLogs],
          };
        }),

      saveOccurrence: (o) => set((s) => ({ occurrences: upsert(s.occurrences, o) })),

      addDocument: (d) => set((s) => ({ documents: [d, ...s.documents] })),
      deleteDocument: (id) => set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),

      markNotificationsRead: (ids) =>
        set((s) => ({ notifications: s.notifications.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)) })),

      resetDemo: () => set(initialData()),
    }),
    {
      name: "laguna-demo-data",
      version: 2,
      storage: safeStorage,
      partialize: (s) => ({
        ...s,
        payments: s.payments.map((p) =>
          p.proof?.dataUrl && p.proof.dataUrl.length > MAX_PERSISTED_PROOF ? { ...p, proof: { ...p.proof, dataUrl: undefined } } : p,
        ),
      }),
    },
  ),
);

/** Lookup rápido de apartamento → etiqueta legível (ex.: "B-302"). */
export function aptLabel(apartments: Apartment[], id?: string) {
  if (!id) return "—";
  const a = apartments.find((x) => x.id === id);
  return a ? `${a.block}-${a.number}` : id.replace("apt_", "").replace(/^([A-Z])/, "$1-");
}
