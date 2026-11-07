import { requireSession } from "@/server/auth";
import { getFraction } from "@/server/mgmt/holders";
import { handle, json } from "@/server/http";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => json(await getFraction((await requireSession(req)).session, (await ctx.params).id)));
}
