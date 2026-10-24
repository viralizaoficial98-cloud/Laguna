/**
 * Testes unitários das regras de negócio (motor de domínio partilhado cliente/servidor),
 * do mapeamento domínio ↔ base de dados e da projecção de dados por perfil.
 *
 *   npm run test:unit
 */
import { createStore } from "zustand/vanilla";
import { accountFor, createActions, initialAll, setDefaultSessionProvider, COLLECTIONS, RESERVATION_CONFLICT_MSG, type DemoActions, type DemoData, type DomainSet } from "@/domain/engine";
import { initialUsers as demoUsers } from "@/data/users";
import { fromRow, toRow, unknownFields } from "@/server/mapping";
import { stable } from "@/server/state";
import { projectFor } from "@/server/projection";
import { can } from "@/config/permissions";
import type { Role, Session } from "@/types";
import { todayISO } from "@/lib/utils";

let pass = 0, fail = 0;
const ok = (name: string, cond: unknown, extra = "") => { if (cond) { pass++; console.log("  ✔", name); } else { fail++; console.log("  ✘", name, extra); } };
const throws = (name: string, fn: () => unknown, match?: string) => { try { fn(); fail++; console.log("  ✘", name, "(não lançou)"); } catch (e) { const m = (e as Error).message; ok(name, !match || m.includes(match), m); } };
let current: Session | null = null;
setDefaultSessionProvider(() => current);
const useDemoStore = createStore<DemoData & DemoActions>()((set, get) => ({ ...initialAll(), ...createActions(set as unknown as DomainSet, get) }));
const as = (email: string, residentId?: string) => {
  const u = demoUsers.find((x) => x.email === email)!;
  current = { userId: u.id, name: u.name, email: u.email, role: u.role, title: u.title, residentId: residentId ?? u.residentId, startedAt: new Date().toISOString() };
};
const S = () => useDemoStore.getState();
const addDays = (n: number) => { const d = new Date(`${todayISO()}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

console.log("1-4 Estrutura e quotas");
const apts = S().apartments.filter((a) => a.active);
ok("T1 só T2/Duplex", apts.every((a) => a.typology === "T2" || a.typology === "Duplex"));
ok("T2 10 blocos / 100 apartamentos", new Set(apts.map((a) => a.block)).size === 10 && apts.length === 100);
ok("T3 80 T2 + 20 Duplex", apts.filter((a) => a.typology === "T2").length === 80 && apts.filter((a) => a.typology === "Duplex").length === 20);
const q4 = S().quotas.filter((q) => q.period === "2026-T4");
ok("T4 quotas T2=300.000 / Duplex=600.000", S().quotas.every((q) => q.amount === (q.typology === "T2" ? 300_000 : 600_000)));
ok("T4b receita teórica 36.000.000 Kz/trimestre", q4.reduce((a, q) => a + q.amount, 0) === 36_000_000, String(q4.reduce((a, q) => a + q.amount, 0)));
ok("T4c sem quotas duplicadas apt+trimestre", new Set(S().quotas.map((q) => q.apartmentId + q.period)).size === S().quotas.length);
as("jose.leiria@residenciallaguna.ao");
ok("T4d emitir de novo não duplica", S().emitQuotas("2026-T4") === 0);

console.log("5 Saraiva");
const sar = demoUsers.find((u) => u.email === "saraiva@residenciallaguna.ao");
ok("T5 Saraiva existe, perfil financeiro", sar?.role === "financeiro" && sar.title === "Gestor Financeiro do Condomínio");
ok("T5b 5 perfis de demonstração", demoUsers.length === 5);

console.log("6-9 Comprovativos");
as("manuel.muenho@residenciallaguna.ao");
const me = S().residents.find((r) => r.id === "res_demo")!;
const open = S().quotas.filter((q) => q.apartmentId === me.apartmentId && (q.status === "pendente" || q.status === "em_atraso"));
ok("há quota em aberto para o morador demo", open.length > 0);
const quota = open[0];
const pay = S().submitPayment({ quotaId: quota.id, apartmentId: quota.apartmentId, residentId: me.id, amount: quota.amount, method: "transferencia", reference: "", paidAt: `${todayISO()}T12:00:00` });
ok("T6 morador submete → Em validação", S().quotas.find((q) => q.id === quota.id)!.status === "em_analise");
const n = S().notifications[0];
ok("T7 notificação para Nelson (gestor) e Saraiva (financeiro)", n.roles.includes("gestor") && n.roles.includes("financeiro"), JSON.stringify(n.roles));
throws("morador não aprova o próprio pagamento", () => S().reviewPayment(pay.id, "aprovado"));
throws("não submete segundo comprovativo em validação", () => S().submitPayment({ quotaId: quota.id, apartmentId: quota.apartmentId, residentId: me.id, amount: quota.amount, method: "transferencia", reference: "", paidAt: `${todayISO()}T12:00:00` }), "validação");
as("nelson.rodrigues@residenciallaguna.ao");
S().reviewPayment(pay.id, "aprovado");
const qa = S().quotas.find((q) => q.id === quota.id)!;
const pa = S().payments.find((p) => p.id === pay.id)!;
ok("T8 aprovação actualiza quota (pago) e auditoria", qa.status === "pago" && qa.paidAmount === quota.amount && pa.reviewedBy === "Nelson Rodrigues" && pa.reviewedByRole === "gestor" && !!pa.receiptNumber);
ok("T7b Saraiva vê a decisão (notificação)", S().notifications.some((x) => x.roles.includes("financeiro") && x.title.includes("Nelson")));
as("saraiva@residenciallaguna.ao");
throws("T9 aprovação duplicada bloqueada", () => S().reviewPayment(pay.id, "aprovado"), "já foi aprovado");
throws("decisão contraditória bloqueada", () => S().reviewPayment(pay.id, "rejeitado", { note: "x" }), "já foi aprovado");
// parcial
const pr = S().residents.find((r) => r.apartmentId && r.id !== me.id && S().quotas.some((q) => q.apartmentId === r.apartmentId && (q.status === "pendente" || q.status === "em_atraso")))!;
as("manuel.muenho@residenciallaguna.ao", pr.id);
const q2 = S().quotas.find((q) => q.apartmentId === pr.apartmentId && (q.status === "pendente" || q.status === "em_atraso"));
ok("existe quota para teste parcial", !!q2);
if (q2) {
  const p2 = S().submitPayment({ quotaId: q2.id, apartmentId: q2.apartmentId, residentId: pr.id, amount: q2.amount / 2, method: "multicaixa", reference: "", paidAt: `${todayISO()}T12:00:00` });
  as("saraiva@residenciallaguna.ao");
  throws("rejeição exige justificação", () => S().reviewPayment(p2.id, "rejeitado"), "justificação");
  S().reviewPayment(p2.id, "aprovado");
  ok("pagamento parcial → Parcialmente pago", S().quotas.find((q) => q.id === q2.id)!.status === "parcial");
  const q2b = S().quotas.find((q) => q.id === q2.id)!;
  ok("parcial: valor pago e remanescente", q2b.paidAmount === q2.amount / 2);
}

console.log("10-14 Reservas");
as("manuel.muenho@residenciallaguna.ao");
// encontrar data livre
let d = 30; while (S().reservations.some((r) => r.date === addDays(d) && r.hallId === "hall_1")) d++;
const D = addDays(d);
const r1 = S().requestReservation({ hallId: "hall_1", date: D, startTime: "15:00", endTime: "20:00", eventType: "Aniversário", eventName: "Teste", expectedGuests: 10, guests: [] });
ok("T10 reserva → pendente de pagamento (bloqueio provisório)", r1.status === "pendente_pagamento" && !!r1.expiresAt && r1.fee === 50_000);
const other = S().residents.find((r) => r.apartmentId && r.id !== me.id)!;
as("manuel.muenho@residenciallaguna.ao", other.id);
throws("T11 outro morador não reserva a mesma data", () => S().requestReservation({ hallId: "hall_1", date: D, startTime: "15:00", endTime: "20:00", eventType: "Outro", eventName: "X", expectedGuests: 5, guests: [] }), RESERVATION_CONFLICT_MSG);
const r2 = S().requestReservation({ hallId: "hall_1", date: addDays(d + 1), startTime: "10:00", endTime: "12:00", eventType: "Outro", eventName: "Outra data", expectedGuests: 5, guests: [] });
ok("T12 outra data disponível pode ser reservada", r2.status === "pendente_pagamento");
const w = S().requestReservation({ hallId: "hall_1", date: D, startTime: "15:00", endTime: "20:00", eventType: "Outro", eventName: "Espera", expectedGuests: 5, guests: [] }, { waitlist: true });
ok("lista de espera numa data pendente", w.status === "em_espera");
// segundo salão independente
as("jose.leiria@residenciallaguna.ao");
S().saveHall({ id: "hall_t", name: "Salão B", active: true, demo: false });
as("manuel.muenho@residenciallaguna.ao", other.id);
ok("salões independentes (mesma data noutro salão)", S().requestReservation({ hallId: "hall_t", date: D, startTime: "15:00", endTime: "20:00", eventType: "Outro", eventName: "B", expectedGuests: 5, guests: [] }).status === "pendente_pagamento");
as("manuel.muenho@residenciallaguna.ao");
S().submitReservationPayment(r1.id, { reference: "", proof: { name: "c.pdf", type: "application/pdf", size: 10 } });
ok("comprovativo da reserva → Em validação", S().reservations.find((r) => r.id === r1.id)!.status === "em_validacao");
as("nelson.rodrigues@residenciallaguna.ao");
throws("Gestor Operacional não valida pagamento de reserva", () => S().reviewReservationPayment(r1.id, "aprovado"));
as("portaria@residenciallaguna.ao");
throws("Portaria não valida reservas", () => S().reviewReservationPayment(r1.id, "aprovado"));
as("saraiva@residenciallaguna.ao");
S().reviewReservationPayment(r1.id, "aprovado");
const rc = S().reservations.find((r) => r.id === r1.id)!;
ok("T13 pagamento da reserva registado e confirmado", rc.status === "confirmada" && rc.payment?.reviewedBy === "Saraiva" && !!rc.payment.receiptNumber);
// expiração e lista de espera: expirar r2
useDemoStore.setState({ reservations: S().reservations.map((r) => (r.id === r2.id ? { ...r, expiresAt: new Date(Date.now() - 1000).toISOString() } : r)) });
ok("expiração liberta a data", S().expireReservations() >= 1 && S().reservations.find((r) => r.id === r2.id)!.status === "expirada");
// cancelar a confirmada promove espera
as("manuel.muenho@residenciallaguna.ao");
S().cancelReservation(r1.id, "teste");
ok("cancelamento promove a lista de espera", S().reservations.find((r) => r.id === w.id)!.status === "pendente_pagamento");

console.log("15-19 Desocupação");
const mo0 = S().moveOuts.find((m) => m.reference.endsWith("-001"))!;
as("manuel.muenho@residenciallaguna.ao");
const mo = S().requestMoveOut({ plannedDate: addDays(20), contact: "+244 900 000 000" });
ok("T15 morador solicita desocupação (referência)", /^DES-\d{4}-\d{3}$/.test(mo.reference) && mo.status === "solicitacao_recebida");
throws("um processo activo por morador", () => S().requestMoveOut({ plannedDate: addDays(20), contact: "x" }), "em curso");
const nn = S().notifications[0];
ok("T16 Nelson e Saraiva notificados", nn.roles.includes("gestor") && nn.roles.includes("financeiro"));
// processo demo 04-302 com dívidas
const acc0 = accountFor(S(), mo0);
ok("T17 conta corrente gerada (quotas, pagos, vencidas)", acc0.quotasTotal > 0 && acc0.lines.length > 0 && acc0.confirmedDebt === acc0.overdue + acc0.charges + acc0.reservationsUnpaid);
ok("T18 dívidas discriminadas por origem/período", acc0.openItems.length > 0 && acc0.openItems.every((o) => o.amount > 0 && o.origin));
as("saraiva@residenciallaguna.ao");
S().runFinancialCheck(mo0.id, "teste");
ok("verificação financeira → Regularização Financeira Pendente", S().moveOuts.find((m) => m.id === mo0.id)!.status === "regularizacao_pendente");
throws("T19 declaração bloqueada com dívidas", () => S().authorizeMoveOut(mo0.id), "Regularização Financeira Pendente");
// regularizar
for (const it of accountFor(S(), mo0).openItems.filter((o) => o.period)) {
  const q = S().quotas.find((x) => x.apartmentId === mo0.apartmentId && x.period === it.period)!;
  S().registerPayment({ quotaId: q.id, amount: q.amount - q.paidAmount, method: "transferencia", reference: "", paidAt: todayISO() });
}
S().runFinancialCheck(mo0.id);
ok("após regularização → situação regularizada", S().moveOuts.find((m) => m.id === mo0.id)!.financial.status === "regularizada", JSON.stringify(accountFor(S(), mo0).openItems));
as("nelson.rodrigues@residenciallaguna.ao");
const cl = S().moveOuts.find((m) => m.id === mo0.id)!.operational.checklist;
throws("verificação operacional não conclui com itens pendentes", () => S().saveOperationalCheck(mo0.id, { checklist: cl, conclude: true }), "pendentes");
const allOk = Object.fromEntries(Object.keys(cl).map((k) => [k, { state: "conforme" }])) as typeof cl;
S().saveOperationalCheck(mo0.id, { checklist: allOk, notes: "ok", conclude: true });
ok("verificação operacional concluída → aguardando aprovação", S().moveOuts.find((m) => m.id === mo0.id)!.status === "aguardando_aprovacao");
S().authorizeMoveOut(mo0.id, "ok");
ok("autorização emitida (Nelson)", S().moveOuts.find((m) => m.id === mo0.id)!.status === "autorizada");
as("saraiva@residenciallaguna.ao");
throws("autorização duplicada bloqueada", () => S().authorizeMoveOut(mo0.id), "já foi autorizado");
S().completeMoveOut(mo0.id);
const aptAfter = S().apartments.find((a) => a.id === mo0.apartmentId)!;
const resAfter = S().residents.find((r) => r.id === mo0.residentId)!;
ok("conclusão actualiza ocupação e preserva histórico", aptAfter.status === "disponivel" && resAfter.status === "inactivo" && !!S().occupancies.find((o) => o.residentId === mo0.residentId)?.to);
as("portaria@residenciallaguna.ao");
throws("Portaria não autoriza desocupação", () => S().authorizeMoveOut(mo.id));
as("jose.leiria@residenciallaguna.ao");
throws("encargo sem fundamentação recusado", () => { as("nelson.rodrigues@residenciallaguna.ao"); S().proposeCharge({ apartmentId: mo.apartmentId, description: "Dano", justification: " ", amount: 1000 }); }, "fundamentação");

console.log("22 Matriz de permissões");
const M: [string, Role[]][] = [
  ["executive.view", ["administrador"]],
  ["finance.view", ["administrador", "financeiro"]],
  ["finance.limited", ["administrador", "gestor", "financeiro"]],
  ["operations.manage", ["gestor"]],
  ["elevators.view", ["administrador", "gestor", "morador"]],
  ["payments.review", ["administrador", "gestor", "financeiro"]],
  ["payments.submit", ["morador"]],
  ["reservations.validate", ["financeiro"]],
  ["reservations.request", ["morador"]],
  ["reservations.events", ["administrador", "gestor", "porteiro"]],
  ["moveout.financial", ["financeiro"]],
  ["moveout.operational", ["gestor"]],
  ["moveout.request", ["morador"]],
  ["moveout.authorized_view", ["porteiro"]],
  ["reports.financial", ["administrador", "financeiro"]],
  ["reports.operational", ["administrador", "gestor"]],
];
const roles: Role[] = ["administrador", "gestor", "financeiro", "morador", "porteiro"];
for (const [perm, allowed] of M) ok(`T22 ${perm}`, roles.every((r) => can(r, perm as never) === allowed.includes(r)));

console.log("Base de dados: mapeamento e projecção");
{
  const d = initialAll();
  let lost = 0;
  let mismatch = 0;
  for (const c of COLLECTIONS) {
    for (const e of d[c] as unknown as Record<string, unknown>[]) {
      lost += unknownFields(c, e).length;
      const once = fromRow(c, toRow(c, e));
      if (stable(fromRow(c, toRow(c, once))) !== stable(once)) mismatch++;
    }
  }
  ok("todos os campos do domínio têm coluna na base de dados", lost === 0, String(lost));
  ok("conversão domínio ↔ linha estável (importação idempotente)", mismatch === 0, String(mismatch));
  const q = toRow("quotas", d.quotas[0] as unknown as Record<string, unknown>);
  ok("montantes enviados como DECIMAL exacto (texto com 2 casas)", q.amount === "300000.00" || q.amount === "600000.00", String(q.amount));
  const mk = (role: Session["role"], residentId?: string): Session => ({ userId: `u_${role}`, name: role, email: `${role}@x`, role, title: role, residentId, startedAt: "" });
  const pm = projectFor(mk("morador", "res_demo"), d);
  ok("projecção morador: só os seus dados", pm.residents.length === 1 && pm.quotas.every((x) => x.apartmentId === "apt_06_201") && pm.expenses.length === 0);
  ok("projecção morador: reservas de outros anonimizadas", pm.reservations.filter((r) => r.residentId !== "res_demo").every((r) => r.eventName === "Reservado" && r.guests.length === 0 && r.residentId === ""));
  const pp = projectFor(mk("porteiro"), d);
  ok("projecção Portaria: sem dados financeiros", pp.payments.length === 0 && pp.quotas.length === 0 && pp.expenses.length === 0 && pp.visits.length === d.visits.length);
  const pf = projectFor(mk("financeiro"), d);
  ok("projecção Gestor Financeiro: sem visitas, com despesas", pf.visits.length === 0 && pf.expenses.length === d.expenses.length);
  const pg = projectFor(mk("gestor"), d);
  ok("projecção Gestor Operacional: sem despesas detalhadas", pg.expenses.length === 0 && pg.payments.length === d.payments.length);
  ok("auditoria apenas para o Administrador", projectFor(mk("administrador"), { ...d, audit: [{ id: "a", at: "", by: "", role: "administrador", action: "x", entity: "y", entityId: "z" }] }).audit.length === 1 && pg.audit.length === 0);
}

console.log(`\n${pass} passaram · ${fail} falharam`);
if (fail) process.exit(1);
