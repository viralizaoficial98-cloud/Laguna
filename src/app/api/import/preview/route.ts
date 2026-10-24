import { assertSameOrigin, requireSession } from "@/server/auth";
import { can } from "@/config/permissions";
import { prisma } from "@/server/db";
import { ActionError } from "@/server/errors";
import { parseBrowserExport, planImport } from "@/server/importer";
import { handle, json, readJson } from "@/server/http";

const MAX = 25 * 1024 * 1024;

/** Pré-visualização da importação de dados exportados de um navegador (sem gravar nada). */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const { session } = await requireSession(req);
    if (!can(session.role, "data.import")) throw new ActionError("Apenas o Administrador pode importar dados.", 403);
    const body = await readJson<{ data?: unknown }>(req, MAX);
    let data;
    try {
      data = parseBrowserExport(body.data);
    } catch (e) {
      throw new ActionError(e instanceof Error ? e.message : "Ficheiro inválido.", 400);
    }
    const plan = await prisma.$transaction((tx) => planImport(tx, data), { timeout: 60_000 });
    return json({ plan: { ...plan, conflicts: plan.conflicts.slice(0, 300), conflictsTotal: plan.conflicts.length } });
  });
}
