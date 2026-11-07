import type { NextRequest } from "next/server";
import { assertSameOrigin, requireSession } from "@/server/auth";
import { declarationOp, previewDeclaration, type DeclOp } from "@/server/mgmt/declarations";
import { handle, json, readJson } from "@/server/http";

/** Pré-visualização dos dados verificados e do texto sugerido. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => json(await previewDeclaration((await requireSession(req)).session, (await ctx.params).id, req.nextUrl.searchParams.get("titularidade") === "1")));
}

/** Operações: review · prepare · sign (confirm) · reject · cancel · revoke. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const { session } = await requireSession(req);
    return json({ declaration: await declarationOp(session, (await ctx.params).id, await readJson<DeclOp>(req, 40_000), req) });
  });
}
