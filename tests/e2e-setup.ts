/**
 * Prepara a base de dados de TESTE para os testes no navegador: activa as cinco contas iniciais
 * com palavras-passe aleatórias e escreve-as em JSON no ficheiro indicado (nunca no repositório).
 *
 *   tsx tests/e2e-setup.ts /caminho/temporario/passwords.json
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { prisma } from "@/server/db";
import { hashPassword } from "@/server/auth";
import { initialUsers } from "@/data/users";

async function main() {
  const out = process.argv[2];
  if (!out) throw new Error("Indique o ficheiro de saída.");
  if (process.env.NODE_ENV === "production") throw new Error("Não executar em produção.");
  const pw: Record<string, string> = {};
  for (const u of initialUsers) {
    pw[u.email] = `E2e-${randomBytes(6).toString("hex")}-7`;
    await prisma.user.update({ where: { email: u.email }, data: { passwordHash: await hashPassword(pw[u.email]), status: "activo", failedLogins: 0, lockedUntil: null } });
  }
  writeFileSync(out, JSON.stringify(pw), { mode: 0o600 });
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
