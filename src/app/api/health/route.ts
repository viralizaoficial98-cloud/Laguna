import { prisma } from "@/server/db";
import { json } from "@/server/http";

/** Verificação de funcionamento (aplicação + base de dados). Não expõe dados. */
export async function GET() {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return json({ ok: true, database: "ok", at: new Date().toISOString() });
  } catch {
    return json({ ok: false, database: "indisponível" }, 503);
  }
}
