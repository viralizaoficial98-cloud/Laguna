import { assertSameOrigin, requireSession } from "@/server/auth";
import { ActionError } from "@/server/errors";
import { getMySignature, revokeSignature, updateSignatureLabels, uploadSignature } from "@/server/mgmt/signature";
import { handle, json, readJson } from "@/server/http";

export async function GET(req: Request) {
  return handle(async () => json(await getMySignature((await requireSession(req)).session)));
}

/** Carregar nova imagem (multipart: file, displayName, title). */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const { session } = await requireSession(req);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ActionError("Seleccione a imagem PNG da assinatura.", 400);
    return json(await uploadSignature(session, Buffer.from(await file.arrayBuffer()), file.name, String(form.get("displayName") ?? ""), String(form.get("title") ?? "")), 201);
  });
}

/** Alterar nome/cargo apresentados. */
export async function PATCH(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const { session } = await requireSession(req);
    const b = await readJson<{ displayName: string; title: string }>(req, 5_000);
    return json(await updateSignatureLabels(session, b.displayName ?? "", b.title ?? ""));
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    return json(await revokeSignature((await requireSession(req)).session));
  });
}
