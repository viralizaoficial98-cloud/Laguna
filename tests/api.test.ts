/**
 * Testes de integração da API contra um servidor em execução e uma base de dados de TESTE.
 * Nunca executar contra a base de dados de produção.
 *
 *   BASE_URL=http://localhost:3100 npm run test:api
 *
 * As palavras-passe de teste são geradas aleatoriamente em cada execução (não ficam no código).
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma } from "@/server/db";
import { issueToken } from "@/server/auth";
import { initialUsers } from "@/data/users";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
let pass = 0;
let fail = 0;
const ok = (name: string, cond: unknown, extra = "") => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? "✔" : "✘"} ${name}${!cond && extra ? ` — ${extra}` : ""}`);
};
const pw = () => `Teste-${randomBytes(6).toString("hex")}-9`;

class Client {
  cookie = "";
  constructor(public label: string) {}
  async req(path: string, init: RequestInit & { json?: unknown } = {}) {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>), ...(this.cookie ? { cookie: this.cookie } : {}) };
    let body = init.body;
    if (init.json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(init.json);
    }
    const res = await fetch(BASE + path, { ...init, headers, body, redirect: "manual" });
    const set = res.headers.get("set-cookie");
    if (set) {
      const m = /laguna_session=([^;]*)/.exec(set);
      if (m) this.cookie = m[1] ? `laguna_session=${m[1]}` : "";
    }
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {
      /* binário */
    }
    return { status: res.status, data, text, headers: res.headers };
  }
  login(email: string, password: string) {
    return this.req("/api/auth/login", { method: "POST", json: { email, password } });
  }
  action(name: string, ...args: unknown[]) {
    return this.req("/api/actions", { method: "POST", json: { name, args } });
  }
  async state() {
    return (await this.req("/api/state")).data.state as Record<string, never[]> & Record<string, unknown>;
  }
}

async function activate(email: string, password: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { email } });
  if (u.status === "bloqueado" || u.status === "inactivo") await prisma.user.update({ where: { id: u.id }, data: { status: u.passwordHash ? "activo" : "pendente_activacao", lockedUntil: null, failedLogins: 0 } });
  const t = await issueToken(u.id, u.passwordHash ? "reset" : "activation", "testes");
  const r = await new Client("anon").req("/api/auth/reset", { method: "POST", json: { token: t.token, password } });
  return r.status === 200;
}

// PNG 1×1 válido
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

async function upload(c: Client, buf: Buffer, name: string, type: string) {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(buf)], name, { type }));
  return c.req("/api/files", { method: "POST", body: form });
}

async function main() {
  console.log(`Servidor: ${BASE}\n`);
  const health = await new Client("x").req("/api/health");
  ok("servidor e base de dados disponíveis", health.status === 200 && health.data.database === "ok");

  // ————— contas iniciais: activação por ligação de utilização única —————
  const P: Record<string, string> = {};
  const C: Record<string, Client> = {};
  for (const u of initialUsers) {
    P[u.role] = pw();
    ok(`activação da conta ${u.email}`, await activate(u.email, P[u.role]));
    C[u.role] = new Client(u.role);
    const r = await C[u.role].login(u.email, P[u.role]);
    ok(`login real — ${u.name} (${u.role})`, r.status === 200 && (r.data.session as { role: string })?.role === u.role, JSON.stringify(r.data));
  }
  const [adm, ges, fin, mor, por] = (["administrador", "gestor", "financeiro", "morador", "porteiro"] as const).map((r) => C[r]);

  const anon = new Client("anon");
  ok("sem sessão: /api/state recusado (401)", (await anon.req("/api/state")).status === 401);
  ok("sem sessão: /painel redirecciona para /login", (await anon.req("/painel")).status === 307);
  ok("sem sessão: /api/auth/me devolve sessão nula", (await anon.req("/api/auth/me")).data.session === null);
  ok("palavra-passe errada recusada", (await anon.login("jose.leiria@residenciallaguna.ao", "errada-123456")).status === 401);
  const users = await prisma.user.findMany();
  ok("palavras-passe guardadas com Argon2id (nunca em texto simples)", users.every((u) => !u.passwordHash || u.passwordHash.startsWith("$argon2id$")));
  ok("pedido de outra origem recusado (CSRF)", (await adm.req("/api/actions", { method: "POST", json: { name: "markNotificationsRead", args: [[]] }, headers: { origin: "https://exemplo-malicioso.com" } })).status === 403);

  // ————— gestão de utilizadores —————
  const list = await ges.req("/api/users");
  ok("Nelson acede à Gestão de Utilizadores (estatísticas)", list.status === 200 && (list.data.stats as { total: number }).total >= 5);
  ok("morador não acede à Gestão de Utilizadores", (await mor.req("/api/users")).status === 403);
  ok("Portaria não acede à Gestão de Utilizadores", (await por.req("/api/users")).status === 403);
  const stamp = Date.now().toString(36);
  const st0 = await adm.state();
  const freeApt = (st0.apartments as { id: string; residentId?: string; active: boolean }[]).find((a) => a.active && a.residentId && !users.some((u) => u.residentId === a.residentId))!;
  const newMor = await ges.req("/api/users", { method: "POST", json: { name: "Morador de Teste", email: `morador.${stamp}@teste.ao`, role: "morador", apartmentId: freeApt.id } });
  ok("Nelson cria conta de morador associada a apartamento", newMor.status === 201 && (newMor.data.user as { status: string }).status === "pendente_activacao", JSON.stringify(newMor.data));
  const morId = (newMor.data.user as { id: string }).id;
  ok("Nelson não pode criar contas de administrador", (await ges.req("/api/users", { method: "POST", json: { name: "X Admin", email: `adm.${stamp}@teste.ao`, role: "administrador" } })).status === 403);
  ok("Nelson não pode atribuir o perfil de Gestor Financeiro", (await ges.req(`/api/users/${morId}`, { method: "PATCH", json: { role: "financeiro" } })).status === 403);
  ok("Nelson não pode alterar a conta de Saraiva", (await ges.req("/api/users/usr_saraiva", { method: "PATCH", json: { name: "Outro" } })).status === 403);
  ok("Nelson não pode alterar a conta de José Leiria", (await ges.req("/api/users/usr_jose_leiria/actions", { method: "POST", json: { op: "block" } })).status === 403);
  ok("Nelson não pode elevar o próprio perfil", (await ges.req("/api/users/usr_nelson_rodrigues", { method: "PATCH", json: { role: "administrador" } })).status === 403);
  ok("José pode criar conta de Gestor Financeiro", (await adm.req("/api/users", { method: "POST", json: { name: "Financeiro Teste", email: `fin.${stamp}@teste.ao`, role: "financeiro" } })).status === 201);
  const edit = await ges.req(`/api/users/${morId}`, { method: "PATCH", json: { name: "Morador de Teste Editado" } });
  ok("edição de utilizador (nome)", edit.status === 200 && (edit.data.user as { name: string }).name === "Morador de Teste Editado");
  ok("email duplicado recusado", (await ges.req("/api/users", { method: "POST", json: { name: "Dup", email: "portaria@residenciallaguna.ao", role: "porteiro" } })).status === 409);

  // redefinição de palavra-passe iniciada por Nelson (sem email configurado → ligação administrativa)
  const link = await ges.req(`/api/users/${morId}/actions`, { method: "POST", json: { op: "reset_link" } });
  ok("Nelson gera ligação de activação (token de utilização única)", link.status === 200 && typeof link.data.link === "string" && !("password" in link.data));
  const token = String(link.data.link).split("token=")[1];
  const morPw = pw();
  ok("titular define a palavra-passe com a ligação", (await anon.req("/api/auth/reset", { method: "POST", json: { token: decodeURIComponent(token), password: morPw } })).status === 200);
  ok("a ligação não pode ser reutilizada", (await anon.req("/api/auth/reset", { method: "POST", json: { token: decodeURIComponent(token), password: pw() } })).status === 400);
  const mor2 = new Client("mor2");
  ok("novo morador inicia sessão", (await mor2.login(`morador.${stamp}@teste.ao`, morPw)).status === 200);
  // redefinição de conta activa termina as sessões
  const link2 = await ges.req(`/api/users/${morId}/actions`, { method: "POST", json: { op: "reset_link" } });
  ok("redefinição de conta activa invalida as sessões abertas", link2.data.type === "reset" && (await mor2.req("/api/state")).status === 401);
  const pw3 = pw();
  await anon.req("/api/auth/reset", { method: "POST", json: { token: decodeURIComponent(String(link2.data.link).split("token=")[1]), password: pw3 } });
  ok("login com a nova palavra-passe", (await mor2.login(`morador.${stamp}@teste.ao`, pw3)).status === 200);
  // alteração pelo próprio
  const pw4 = pw();
  ok("alteração da palavra-passe pelo titular (exige a actual)", (await mor2.req("/api/auth/change-password", { method: "POST", json: { current: "errada-000000", next: pw4 } })).status === 400 && (await mor2.req("/api/auth/change-password", { method: "POST", json: { current: pw3, next: pw4 } })).status === 200);
  // bloqueio por tentativas
  const attacker = new Client("att");
  for (let i = 0; i < 5; i++) await attacker.login(`morador.${stamp}@teste.ao`, `errada-${i}-abcdef`);
  ok("bloqueio temporário após 5 tentativas falhadas", (await attacker.login(`morador.${stamp}@teste.ao`, pw4)).status === 423);
  ok("Nelson desbloqueia a conta", (await ges.req(`/api/users/${morId}/actions`, { method: "POST", json: { op: "unlock" } })).status === 200 && (await mor2.login(`morador.${stamp}@teste.ao`, pw4)).status === 200);
  ok("bloqueio administrativo termina a sessão e impede o login", (await ges.req(`/api/users/${morId}/actions`, { method: "POST", json: { op: "block" } })).status === 200 && (await mor2.req("/api/state")).status === 401 && (await mor2.login(`morador.${stamp}@teste.ao`, pw4)).status === 403);
  await ges.req(`/api/users/${morId}/actions`, { method: "POST", json: { op: "unlock" } });
  await mor2.login(`morador.${stamp}@teste.ao`, pw4);
  const hist = await ges.req(`/api/users/${morId}/history`);
  const histText = JSON.stringify(hist.data);
  ok("histórico de alterações e acessos registado", hist.status === 200 && (hist.data.changes as unknown[]).length >= 5 && (hist.data.logins as unknown[]).length >= 5);
  ok("o histórico não contém palavras-passe nem tokens", !histText.includes(pw4) && !histText.includes(token) && !histText.includes("argon2"));

  // ————— projecção por perfil —————
  const sMor = await mor.state();
  const sPor = await por.state();
  const sFin = await fin.state();
  ok("morador só recebe o seu registo de morador", (sMor.residents as unknown[]).length === 1);
  ok("morador não recebe pagamentos de outras fracções", (sMor.payments as { residentId?: string; apartmentId: string }[]).every((p) => p.apartmentId === "apt_06_201" || p.residentId === "res_demo"));
  ok("morador não recebe despesas nem auditoria", (sMor.expenses as unknown[]).length === 0 && (sMor.audit as unknown[]).length === 0);
  ok("Portaria não recebe dados financeiros", (sPor.payments as unknown[]).length === 0 && (sPor.quotas as unknown[]).length === 0);
  ok("Gestor Financeiro não recebe o registo de visitas", (sFin.visits as unknown[]).length === 0);

  // ————— comprovativo, aprovação concorrente e conta corrente —————
  const bad = await upload(mor, Buffer.from("isto não é um PDF"), "falso.pdf", "application/pdf");
  ok("ficheiro com formato inválido recusado (assinatura verificada)", bad.status === 415);
  const up = await upload(mor, PNG, "comprovativo.png", "image/png");
  ok("comprovativo guardado no servidor (fora da pasta pública)", up.status === 201 && typeof up.data.id === "string");
  const fileId = up.data.id as string;
  type Q = { id: string; apartmentId: string; amount: number; paidAmount: number; status: string; period: string };
  let quota = (sMor.quotas as Q[]).find((q) => q.status === "pendente" || q.status === "em_atraso");
  if (!quota) {
    // execuções anteriores pagaram as quotas: emite o trimestre seguinte (operação do Administrador)
    const last = (sMor.quotas as Q[]).map((q) => q.period).sort().at(-1)!;
    const [y, t] = last.split("-T").map(Number);
    const next = t === 4 ? `${y + 1}-T1` : `${y}-T${t + 1}`;
    ok(`emissão das quotas do trimestre ${next} (sem duplicações)`, (await adm.action("emitQuotas", next)).status === 200);
    quota = ((await mor.state()).quotas as Q[]).find((q) => q.status === "pendente" || q.status === "em_atraso");
  }
  ok("morador tem quota em aberto", !!quota);
  const sub = await mor.action("submitPayment", { quotaId: quota!.id, apartmentId: quota!.apartmentId, residentId: "res_demo", amount: quota!.amount - quota!.paidAmount, method: "transferencia", reference: "", paidAt: new Date().toISOString(), proof: { name: "comprovativo.png", type: "image/png", size: PNG.length, fileId } });
  ok("morador submete comprovativo → Em Validação", sub.status === 200, JSON.stringify(sub.data.error));
  const payment = ((await ges.state()).payments as { id: string; quotaId: string; status: string }[]).find((p) => p.quotaId === quota!.id && p.status === "em_analise")!;
  ok("Nelson vê o pagamento em validação", !!payment);
  ok("Saraiva recebe a notificação", ((await fin.state()).notifications as { title: string }[]).some((n) => n.title === "Comprovativo para validação"));
  ok("Nelson recebe a notificação", ((await ges.state()).notifications as { title: string }[]).some((n) => n.title === "Comprovativo para validação"));
  ok("morador não pode aprovar o próprio pagamento", (await mor.action("reviewPayment", payment.id, "aprovado")).status === 403);
  ok("Portaria não pode aprovar pagamentos", (await por.action("reviewPayment", payment.id, "aprovado")).status === 403);
  ok("comprovativo acessível ao autor e à gestão", (await mor.req(`/api/files/${fileId}`)).status === 200 && (await fin.req(`/api/files/${fileId}`)).status === 200);
  ok("comprovativo inacessível à Portaria e a outro morador", (await por.req(`/api/files/${fileId}`)).status === 403 && (await mor2.req(`/api/files/${fileId}`)).status === 403);
  // Nelson e Saraiva decidem ao mesmo tempo → apenas uma decisão
  const [r1, r2] = await Promise.all([ges.action("reviewPayment", payment.id, "aprovado"), fin.action("reviewPayment", payment.id, "rejeitado", { note: "teste de concorrência" })]);
  const okCount = [r1, r2].filter((r) => r.status === 200).length;
  ok("decisões simultâneas: apenas uma é aceite (transacção)", okCount === 1, `${r1.status}/${r2.status}`);
  const loser = r1.status === 200 ? r2 : r1;
  ok("a segunda decisão é recusada com indicação de quem decidiu", /já foi (aprovado|rejeitado) por/.test(String(loser.data.error)), String(loser.data.error));
  const after = ((await mor.state()).payments as { id: string; status: string; reviewedBy?: string }[]).find((p) => p.id === payment.id)!;
  ok("estado actualizado para todos (morador vê a decisão)", after.status !== "em_analise" && !!after.reviewedBy);
  const dbPay = (await prisma.$queryRawUnsafe(`SELECT CAST(amount AS CHAR) AS a, DATA_TYPE AS t FROM payments, information_schema.COLUMNS WHERE payments.id = '${payment.id}' AND COLUMNS.TABLE_SCHEMA = DATABASE() AND COLUMNS.TABLE_NAME = 'payments' AND COLUMNS.COLUMN_NAME = 'amount'`)) as { a: string; t: string }[];
  ok("montantes em DECIMAL exacto na base de dados", dbPay[0]?.t === "decimal" && /^\d+\.\d{2}$/.test(dbPay[0]?.a), JSON.stringify(dbPay));
  const dupSub = await mor.action("submitPayment", { quotaId: quota!.id, apartmentId: quota!.apartmentId, residentId: "res_demo", amount: 1, method: "transferencia", reference: "", paidAt: new Date().toISOString() });
  if (after.status === "aprovado") ok("quota paga não aceita novo comprovativo", dupSub.status >= 400);

  // ————— reservas exclusivas (pedidos simultâneos de dois moradores) —————
  const d = new Date(Date.now() + (60 + Math.floor(Math.random() * 200)) * 86400_000).toISOString().slice(0, 10);
  const input = (name: string) => ({ hallId: "hall_1", date: d, startTime: "15:00", endTime: "20:00", eventType: "Aniversário", eventName: name, expectedGuests: 10, guests: [] });
  const [a1, a2] = await Promise.all([mor.action("requestReservation", input("Teste A")), mor2.action("requestReservation", input("Teste B"))]);
  ok("reserva: pedidos simultâneos para o mesmo salão e data — apenas um aceite", [a1, a2].filter((r) => r.status === 200).length === 1, `${a1.status}/${a2.status}`);
  const rej = a1.status === 200 ? a2 : a1;
  ok("mensagem de data indisponível", String(rej.data.error).includes("já se encontra reservado"), String(rej.data.error));
  const slotCount = await prisma.reservationSlot.count({ where: { hallId: "hall_1", date: new Date(`${d}T00:00:00.000Z`) } });
  ok("restrição na base de dados: um único registo salão/data", slotCount === 1);
  const winner = a1.status === 200 ? mor : mor2;
  const myRes = ((await winner.state()).reservations as { id: string; date: string; status: string; eventName: string }[]).find((r) => r.date === d && r.eventName.startsWith("Teste"))!;
  ok("reserva criada como Pendente de Pagamento (50.000 Kz)", myRes?.status === "pendente_pagamento");
  const up2 = await upload(winner, PNG, "reserva.png", "image/png");
  ok("comprovativo da reserva anexado", (await winner.action("submitReservationPayment", myRes.id, { reference: "", proof: { name: "reserva.png", type: "image/png", size: PNG.length, fileId: up2.data.id } })).status === 200);
  ok("Nelson não valida pagamentos de reservas", (await ges.action("reviewReservationPayment", myRes.id, "aprovado")).status === 403);
  ok("Saraiva valida → reserva confirmada (argumento opcional nulo aceite)", (await fin.action("reviewReservationPayment", myRes.id, "aprovado", null)).status === 200);
  const porRes = ((await por.state()).reservations as { id: string; guests: unknown[] }[]).find((r) => r.id === myRes.id);
  ok("Portaria consulta a reserva confirmada (lista de convidados)", !!porRes && Array.isArray(porRes.guests));
  ok("cancelamento liberta a data", (await winner.action("cancelReservation", myRes.id, "teste")).status === 200 && (await prisma.reservationSlot.count({ where: { reservationId: myRes.id } })) === 0);

  // ————— operações: dados de Nelson visíveis para José (outro dispositivo) —————
  const elv = ((await ges.state()).elevators as { id: string; status: string }[]).find((e) => e.status === "operacional")!;
  ok("Nelson regista avaria de elevador", (await ges.action("setElevatorStatus", elv.id, "avariado", { type: "avaria", description: "Teste de integração", createOccurrence: true })).status === 200);
  const sAdm = await adm.state();
  ok("José vê o elevador avariado e a ocorrência criada", (sAdm.elevators as { id: string; status: string }[]).find((e) => e.id === elv.id)?.status === "avariado" && (sAdm.occurrences as { elevatorId?: string; status: string }[]).some((o) => o.elevatorId === elv.id && o.status !== "resolvida"));
  ok("Nelson repõe o elevador (resolve a ocorrência)", (await ges.action("setElevatorStatus", elv.id, "operacional", { type: "intervencao", description: "Reparado (teste)" })).status === 200);
  const task = ((await ges.state()).opsTasks as { id: string; area: string; status: string }[]).find((t) => t.area === "limpeza" && t.status !== "concluida")!;
  ok("Nelson actualiza actividade de limpeza", (await ges.action("saveOpsTask", { ...task, status: "concluida", executedDate: new Date().toISOString().slice(0, 10) })).status === 200);
  ok("Saraiva não pode alterar actividades operacionais", (await fin.action("saveOpsTask", task)).status === 403);
  ok("morador regista ocorrência", (await mor.action("reportOccurrence", { title: "Teste de integração", description: "Lâmpada fundida", category: "Electricidade", location: "Bloco 06 — escada" })).status === 200);

  // ————— desocupação —————
  const mo = await mor2.action("requestMoveOut", { plannedDate: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10), contact: "+244 900 000 000" });
  ok("morador solicita desocupação", mo.status === 200, String(mo.data.error));
  ok("um processo activo por morador", (await mor2.action("requestMoveOut", { plannedDate: new Date(Date.now() + 31 * 86400_000).toISOString().slice(0, 10), contact: "x" })).status >= 400);
  const proc = ((await fin.state()).moveOuts as { id: string; residentName: string; status: string }[]).find((m) => m.status === "solicitacao_recebida")!;
  ok("Saraiva vê o processo", !!proc);
  ok("verificação financeira registada", (await fin.action("runFinancialCheck", proc.id, "teste")).status === 200);
  const procAfter = ((await fin.state()).moveOuts as { id: string; status: string; financial: { status: string } }[]).find((m) => m.id === proc.id)!;
  if (procAfter.financial.status === "regularizacao_pendente") ok("declaração bloqueada com dívidas confirmadas", String((await fin.action("authorizeMoveOut", proc.id)).data.error).includes("Regularização Financeira Pendente"));
  else ok("processo sem dívidas segue para verificação operacional", procAfter.status === "em_verificacao_operacional");
  ok("Portaria não pode autorizar desocupações", (await por.action("authorizeMoveOut", proc.id)).status === 403);

  // ————— validação e auditoria —————
  ok("argumentos inválidos recusados (validação)", (await mor.action("submitPayment", { quotaId: quota!.id, amount: -5 })).status === 400);
  ok("operação desconhecida recusada", (await adm.action("resetDemo")).status === 400);
  const logs = await prisma.actionLog.count({ where: { at: { gte: new Date(Date.now() - 10 * 60_000) } } });
  ok("registo técnico de todas as operações (aceites e recusadas)", logs > 20);
  const audits = await prisma.auditEntry.count();
  ok("auditoria de negócio persistida", audits > 0);

  console.log(`\n${pass} passaram · ${fail} falharam`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
