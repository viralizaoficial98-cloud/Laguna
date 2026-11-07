import { assertSameOrigin, requireSession } from "@/server/auth";
import { can } from "@/config/permissions";
import { prisma } from "@/server/db";
import { ActionError } from "@/server/errors";
import { saveFile } from "@/server/files";
import { previewImport } from "@/server/mgmt/excel-import";
import { handle, json } from "@/server/http";

/** Envia os ficheiros Excel (guardados de forma privada) e devolve a pré-visualização — nada é importado. */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const { session } = await requireSession(req);
    if (!can(session.role, "data.import")) throw new ActionError("Sem permissão para importar dados.", 403);
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length || files.length > 5) throw new ActionError("Seleccione entre 1 e 5 ficheiros .xlsx.", 400);
    const ids: string[] = [];
    for (const f of files) {
      const saved = await saveFile(Buffer.from(await f.arrayBuffer()), f.name, session, null, { allowXlsx: true, maxBytes: 10 * 1024 * 1024 });
      await prisma.storedFile.update({ where: { id: saved.id }, data: { category: "import" } });
      ids.push(saved.id);
    }
    return json({ fileIds: ids, plan: await previewImport(session, ids) });
  });
}
