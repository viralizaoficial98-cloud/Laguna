import { assertSameOrigin, requireSession } from "@/server/auth";
import { ActionError } from "@/server/errors";
import { applyImport, type Decisions } from "@/server/mgmt/excel-import";
import { handle, json, readJson } from "@/server/http";

/** Importação confirmada (cópia de segurança automática antes de gravar). */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const { session } = await requireSession(req);
    const b = await readJson<{ fileIds?: string[]; decisions?: Decisions; confirm?: boolean }>(req, 200_000);
    if (b.confirm !== true) throw new ActionError("Confirme a importação.", 400);
    if (!Array.isArray(b.fileIds) || !b.fileIds.length) throw new ActionError("Sem ficheiros para importar.", 400);
    return json(await applyImport(session, b.fileIds.map(String), b.decisions ?? {}));
  });
}
