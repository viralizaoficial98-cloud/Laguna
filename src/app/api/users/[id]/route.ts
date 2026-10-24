import { assertSameOrigin, clientIp, requireSession } from "@/server/auth";
import { updateUser, type UserInput } from "@/server/users";
import { handle, json, readJson } from "@/server/http";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const { session } = await requireSession(req);
    const { id } = await ctx.params;
    const body = await readJson<Partial<UserInput>>(req, 10_000);
    return json({ user: await updateUser(session, id, body, clientIp(req)) });
  });
}
