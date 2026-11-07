import { assertSameOrigin, requireSession } from "@/server/auth";
import { voidRevenue } from "@/server/mgmt/budget";
import { handle, json, readJson } from "@/server/http";

/** Anular (as receitas nunca são apagadas). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const { session } = await requireSession(req);
    const b = await readJson<{ reason?: string }>(req, 5_000);
    return json(await voidRevenue(session, (await ctx.params).id, b.reason ?? ""));
  });
}
