import { assertSameOrigin, requireSession } from "@/server/auth";
import { updateParty, type PartyInput } from "@/server/mgmt/holders";
import { handle, json, readJson } from "@/server/http";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const { session } = await requireSession(req);
    return json({ party: await updateParty(session, (await ctx.params).id, await readJson<Partial<PartyInput> & { archived?: boolean }>(req, 20_000)) });
  });
}
