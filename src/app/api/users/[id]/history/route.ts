import { requireSession } from "@/server/auth";
import { userHistory } from "@/server/users";
import { handle, json } from "@/server/http";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { session } = await requireSession(req);
    const { id } = await ctx.params;
    return json(await userHistory(session, id));
  });
}
