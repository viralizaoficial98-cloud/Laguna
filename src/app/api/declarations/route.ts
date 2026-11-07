import { assertSameOrigin, requireSession } from "@/server/auth";
import { createDeclaration, listDeclarations, requestDeclaration } from "@/server/mgmt/declarations";
import { handle, json, readJson } from "@/server/http";

export async function GET(req: Request) {
  return handle(async () => json(await listDeclarations((await requireSession(req)).session)));
}

/** Morador: { typeCode, purpose } · Gestão (presencial): { typeCode, apartmentId, subject, purpose }. */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const { session } = await requireSession(req);
    const b = await readJson<{ typeCode: string; purpose?: string; apartmentId?: string; subject?: "morador" | "proprietario" | "inquilino" }>(req, 10_000);
    if (session.role === "morador") return json({ declaration: await requestDeclaration(session, b) }, 201);
    return json({ declaration: await createDeclaration(session, { typeCode: b.typeCode, apartmentId: b.apartmentId ?? "", subject: b.subject ?? "morador", purpose: b.purpose }) }, 201);
  });
}
