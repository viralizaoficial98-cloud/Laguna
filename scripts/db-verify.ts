/**
 * Verificação da base de dados após a importação: contagens face à fonte, estrutura oficial do
 * condomínio, integridade financeira e consistência das restrições de exclusividade.
 *
 *   npm run db:verify
 */
import "dotenv/config";
import { COLLECTIONS, initialAll, BLOCKING_RESERVATION } from "@/domain/engine";
import { createPrisma } from "@/server/db";
import { loadState } from "@/server/state";
import { computeAccount } from "@/lib/account";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "✔" : "✘"} ${name}${detail ? ` — ${detail}` : ""}`);
};

async function main() {
  const prisma = createPrisma();
  const db = await prisma.$transaction((tx) => loadState(tx), { timeout: 60_000 });
  const src = initialAll();

  console.log("Contagens (fonte frontend → base de dados):");
  for (const c of COLLECTIONS) {
    const ids = new Set((db[c] as { id: string }[]).map((r) => r.id));
    const missing = (src[c] as { id: string }[]).filter((r) => !ids.has(r.id)).length;
    console.log(`  ${c.padEnd(15)} fonte ${String(src[c].length).padStart(4)} · BD ${String(db[c].length).padStart(4)}${missing ? ` · em falta ${missing}` : ""}`);
    if (missing) failures++;
  }
  const apts = db.apartments.filter((a) => a.active);
  check("10 blocos", new Set(apts.map((a) => a.block)).size === 10);
  check("100 apartamentos activos", apts.length === 100, String(apts.length));
  check("80 T2 + 20 Duplex", apts.filter((a) => a.typology === "T2").length === 80 && apts.filter((a) => a.typology === "Duplex").length === 20);
  check("sem tipologias T3/T4", db.apartments.every((a) => a.typology === "T2" || a.typology === "Duplex"));
  check("quotas T2 = 300.000 / Duplex = 600.000", db.quotas.every((q) => q.amount === db.settings.quotaByTypology[q.typology]));
  const byPeriod = new Map<string, number>();
  db.quotas.forEach((q) => byPeriod.set(q.period, (byPeriod.get(q.period) ?? 0) + q.amount));
  const lastFull = [...byPeriod.entries()].sort().at(-1);
  check("receita prevista 36.000.000 Kz no último trimestre emitido", lastFull?.[1] === 36_000_000, `${lastFull?.[0]}: ${lastFull?.[1]?.toLocaleString("pt-PT")} Kz`);
  check("uma quota por fracção e trimestre", new Set(db.quotas.map((q) => `${q.apartmentId}|${q.period}`)).size === db.quotas.length);
  // integridade financeira: valor pago de cada quota = soma dos pagamentos aprovados
  const bad = db.quotas.filter((q) => {
    const paid = db.payments.filter((p) => p.quotaId === q.id && p.status === "aprovado").reduce((a, p) => a + (p.validatedAmount ?? p.amount), 0);
    return Math.abs(paid - q.paidAmount) > 0.005;
  });
  check("valor pago das quotas coincide com os pagamentos aprovados", bad.length === 0, bad.length ? `${bad.length} divergências (ex.: ${bad[0].id})` : "");
  check("nenhum pagamento aprovado excede a quota", db.quotas.every((q) => q.paidAmount <= q.amount + 0.005));
  const totalDebt = db.apartments.reduce((a, apt) => a + computeAccount({ apartmentId: apt.id, quotas: db.quotas, payments: db.payments, charges: db.charges, reservations: db.reservations }).confirmedDebt, 0);
  console.log(`  dívida confirmada total (contas correntes): ${totalDebt.toLocaleString("pt-PT")} Kz`);
  const slots = await prisma.reservationSlot.findMany();
  const blocking = db.reservations.filter((r) => BLOCKING_RESERVATION.includes(r.status));
  check("reservas activas = registos de exclusividade (salão/data)", slots.length === blocking.length && blocking.every((r) => slots.some((s) => s.reservationId === r.id)), `${blocking.length} activas · ${slots.length} slots`);
  const pend = await prisma.pendingPaymentSlot.count();
  check("comprovativos em validação = registos de exclusividade", pend === db.payments.filter((p) => p.status === "em_analise").length);
  const users = await prisma.user.findMany();
  check("cinco perfis criados", ["administrador", "gestor", "financeiro", "morador", "porteiro"].every((r) => users.some((u) => u.role === r)), `${users.length} contas`);
  check("nenhuma palavra-passe em texto simples", users.every((u) => !u.passwordHash || u.passwordHash.startsWith("$argon2id$")));
  console.log(failures ? `\n${failures} verificação(ões) falharam.` : "\nTodas as verificações passaram.");
  await prisma.$disconnect();
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("Erro:", e instanceof Error ? e.message : e);
  process.exit(1);
});
