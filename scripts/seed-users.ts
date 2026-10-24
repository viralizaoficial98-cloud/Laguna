/**
 * Cria as cinco contas iniciais (se ainda não existirem) SEM palavra-passe, no estado
 * "pendente de activação". Nunca altera contas existentes.
 *
 *   npm run db:seed-users
 */
import "dotenv/config";
import { createPrisma } from "@/server/db";
import { initialUsers } from "@/data/users";

async function main() {
  const prisma = createPrisma();
  for (const u of initialUsers) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      console.log(`= ${u.email} já existe (${existing.status}) — não alterado`);
      continue;
    }
    let residentId: string | null = u.residentId ?? null;
    let apartmentId: string | null = null;
    let block: string | null = null;
    if (residentId) {
      const r = await prisma.resident.findUnique({ where: { id: residentId } });
      if (!r) {
        console.log(`! morador ${residentId} não existe na base de dados — execute primeiro "npm run db:import -- --apply"`);
        residentId = null;
      } else {
        apartmentId = r.apartmentId;
        block = r.apartmentId ? (await prisma.apartment.findUnique({ where: { id: r.apartmentId } }))?.block ?? null : null;
      }
    }
    await prisma.user.create({ data: { id: u.id, name: u.name, email: u.email, role: u.role, title: u.title, status: "pendente_activacao", residentId, apartmentId, block, createdBy: "seed" } });
    await prisma.userAuditLog.create({ data: { actorName: "Instalação", targetId: u.id, targetName: u.name, action: "conta_criada", after: JSON.stringify({ role: u.role, status: "pendente_activacao" }) } });
    console.log(`+ ${u.email} criado (${u.role}) — pendente de activação`);
  }
  console.log('\nPara activar uma conta: npm run users:activation-link -- <email>');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Erro:", e instanceof Error ? e.message : e);
  process.exit(1);
});
