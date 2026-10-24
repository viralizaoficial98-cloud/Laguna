/**
 * Gera uma ligação de activação (conta sem palavra-passe) ou de redefinição (conta activa),
 * de utilização única, para entregar ao titular por um canal seguro.
 * A ligação é mostrada apenas neste terminal e não fica registada em logs.
 *
 *   npm run users:activation-link -- jose.leiria@residenciallaguna.ao [--hours=24]
 */
import "dotenv/config";
import { createPrisma } from "@/server/db";

async function main() {
  const email = process.argv.slice(2).find((a) => !a.startsWith("--"))?.toLowerCase();
  const hours = Number(process.argv.find((a) => a.startsWith("--hours="))?.split("=")[1] ?? 0) || undefined;
  if (!email) throw new Error("Indique o email: npm run users:activation-link -- <email>");
  const prisma = createPrisma();
  // importação tardia: o módulo de autenticação usa o cliente partilhado
  const { issueToken } = await import("@/server/auth");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Conta inexistente: ${email}`);
  if (user.status === "inactivo" || user.status === "bloqueado") throw new Error(`A conta está ${user.status}. Reactive-a primeiro.`);
  const type = user.passwordHash ? "reset" : "activation";
  const t = await issueToken(user.id, type, "linha de comandos", hours);
  await prisma.userAuditLog.create({ data: { actorName: "Linha de comandos", targetId: user.id, targetName: user.name, action: type === "reset" ? "redefinicao_iniciada" : "activacao_iniciada", after: JSON.stringify({ expiresHours: t.expiresHours }) } });
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  console.log(`\n${type === "reset" ? "Redefinição" : "Activação"} de ${user.name} <${user.email}> — válida durante ${t.expiresHours} h, utilização única:\n\n${base}${t.path}\n`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("Erro:", e instanceof Error ? e.message : e);
  process.exit(1);
});
