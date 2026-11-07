import { assertSameOrigin, requireSession } from "@/server/auth";
import { deleteLine, updateLine } from "@/server/mgmt/budget";
import { handle, json, readJson } from "@/server/http";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const { session } = await requireSession(req);
    return json(await updateLine(session, (await ctx.params).id, await readJson(req, 10_000)));
  });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    return json(await deleteLine((await requireSession(req)).session, (await ctx.params).id));
  });
}
