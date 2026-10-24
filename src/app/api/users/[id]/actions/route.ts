import { appUrl, assertSameOrigin, clientIp, requireSession } from "@/server/auth";
import { userOperation, type UserOp } from "@/server/users";
import { ActionError } from "@/server/errors";
import { handle, json, readJson } from "@/server/http";

const OPS: UserOp[] = ["activate", "deactivate", "block", "unlock", "reset_link", "activation_link", "revoke_sessions"];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(req);
    const { session } = await requireSession(req);
    const { id } = await ctx.params;
    const { op } = await readJson<{ op?: UserOp }>(req, 2_000);
    if (!op || !OPS.includes(op)) throw new ActionError("Operação inválida.", 400);
    return json(await userOperation(session, id, op, clientIp(req), appUrl(req)));
  });
}
