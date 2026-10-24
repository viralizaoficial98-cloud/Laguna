import { assertSameOrigin, requireSession } from "@/server/auth";
import { can } from "@/config/permissions";
import { prisma } from "@/server/db";
import { ActionError } from "@/server/errors";
import { applyImport, parseBrowserExport } from "@/server/importer";
import { handle, json, readJson } from "@/server/http";

const MAX = 25 * 1024 * 1024;

/** Importação confirmada: insere registos novos; só substitui os conflitos explicitamente confirmados. */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const { session } = await requireSession(req);
    if (!can(session.role, "data.import")) throw new ActionError("Apenas o Administrador pode importar dados.", 403);
    const body = await readJson<{ data?: unknown; overwrite?: string[]; applySettings?: boolean; confirm?: boolean }>(req, MAX);
    if (body.confirm !== true) throw new ActionError("Confirme a importação.", 400);
    let data;
    try {
      data = parseBrowserExport(body.data);
    } catch (e) {
      throw new ActionError(e instanceof Error ? e.message : "Ficheiro inválido.", 400);
    }
    const result = await prisma.$transaction((tx) => applyImport(tx, data, { overwrite: Array.isArray(body.overwrite) ? body.overwrite.map(String) : [], applySettings: !!body.applySettings, by: session, source: "navegador" }), {
      timeout: 120_000,
      maxWait: 15_000,
    });
    return json({ result });
  });
}
