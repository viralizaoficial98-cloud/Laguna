import { assertSameOrigin, requireSession } from "@/server/auth";
import { ActionError } from "@/server/errors";
import { MAX_FILE_BYTES, saveFile } from "@/server/files";
import { handle, json } from "@/server/http";

/** Envio de anexo (comprovativos, fotografias, PDFs). Guardado fora da pasta pública. */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const { session } = await requireSession(req);
    if (session.role === "porteiro") throw new ActionError("A Portaria não envia anexos.", 403);
    if (Number(req.headers.get("content-length") ?? 0) > MAX_FILE_BYTES + 64 * 1024) throw new ActionError("Ficheiro demasiado grande.", 413);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ActionError("Ficheiro em falta.", 400);
    const saved = await saveFile(Buffer.from(await file.arrayBuffer()), file.name, session);
    return json(saved, 201);
  });
}
