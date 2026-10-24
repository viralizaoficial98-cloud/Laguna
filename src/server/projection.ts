/**
 * Projecção do estado por perfil: o servidor só envia a cada utilizador os dados que o perfil
 * pode consultar (matriz de permissões). Dados de outros moradores são omitidos ou anonimizados.
 */
import type { DemoData } from "@/domain/engine";
import type { MoveOut, Reservation, Session } from "@/types";
import { can } from "@/config/permissions";

const none = <T,>(): T[] => [];

function notificationsFor(sess: Session, d: DemoData) {
  return d.notifications
    .filter((n) => n.roles.includes(sess.role) && (sess.role !== "morador" || !n.residentId || n.residentId === sess.residentId))
    .map(({ readBy, ...n }) => ({ ...n, read: readBy ? readBy.includes(sess.userId) : n.read }));
}

function anonymousReservation(r: Reservation): Reservation {
  return { ...r, residentId: "", apartmentId: "", eventName: "Reservado", eventType: "", guests: [], notes: undefined, payment: undefined, history: [], expectedGuests: 0 };
}

function publicMoveOut(m: MoveOut): MoveOut {
  return {
    ...m,
    reason: undefined,
    notes: undefined,
    contact: "",
    financial: { status: m.financial.status },
    operational: { status: m.operational.status, checklist: m.operational.checklist },
    history: [],
  };
}

export function projectFor(sess: Session, d: DemoData): DemoData {
  const base: DemoData = { ...d, notifications: notificationsFor(sess, d), audit: sess.role === "administrador" ? d.audit : [] };

  if (sess.role === "administrador") return base;

  if (sess.role === "gestor" || sess.role === "financeiro") {
    return {
      ...base,
      expenses: can(sess.role, "expenses.view") ? d.expenses : none(),
      visits: can(sess.role, "visits.view_all") ? d.visits : none(),
      visitChecks: can(sess.role, "visits.view_all") ? d.visitChecks : none(),
      accessLogs: can(sess.role, "visits.view_all") ? d.accessLogs : none(),
    };
  }

  const minimalApartments = d.apartments.map((a) => ({ ...a, ownerName: "", notes: undefined, residentId: undefined }));

  if (sess.role === "porteiro") {
    return {
      ...base,
      apartments: minimalApartments,
      residents: d.residents.map((r) => ({ id: r.id, name: r.name, apartmentId: r.apartmentId, status: r.status, email: "", phone: "", documentId: "", type: r.type, since: r.since, dependents: [] })),
      quotas: none(),
      payments: none(),
      charges: none(),
      expenses: none(),
      occupancies: none(),
      circulars: none(),
      notices: none(),
      documents: none(),
      occurrences: none(),
      elevators: none(),
      opsTasks: none(),
      reservations: d.reservations.filter((r) => r.status === "confirmada"),
      moveOuts: d.moveOuts.filter((m) => m.status === "autorizada" || m.status === "concluida").map(publicMoveOut),
    };
  }

  // morador: apenas os seus dados
  const me = d.residents.find((r) => r.id === sess.residentId);
  const aptId = me?.apartmentId;
  const ownApt = (id?: string) => !!id && id === aptId;
  return {
    ...base,
    apartments: d.apartments.map((a) => (a.id === aptId ? a : { ...a, ownerName: "", notes: undefined, residentId: undefined })),
    residents: me ? [me] : [],
    quotas: d.quotas.filter((q) => ownApt(q.apartmentId)),
    payments: d.payments.filter((p) => ownApt(p.apartmentId) || p.residentId === sess.residentId),
    charges: d.charges.filter((c) => ownApt(c.apartmentId) && c.status !== "proposto"),
    occupancies: d.occupancies.filter((o) => o.residentId === sess.residentId),
    expenses: none(),
    circulars: d.circulars.filter((c) => c.status === "publicada"),
    notices: d.notices.filter((n) => n.status === "publicado"),
    documents: d.documents.filter((x) => x.visibility !== "administracao"),
    visits: d.visits.filter((v) => v.residentId === sess.residentId),
    visitChecks: d.visitChecks.filter((c) => d.visits.some((v) => v.id === c.visitId && v.residentId === sess.residentId)),
    accessLogs: none(),
    occurrences: d.occurrences.filter((o) => o.residentId === sess.residentId),
    opsTasks: none(),
    reservations: d.reservations.map((r) => (r.residentId === sess.residentId ? r : anonymousReservation(r))),
    moveOuts: d.moveOuts.filter((m) => m.residentId === sess.residentId),
  };
}
