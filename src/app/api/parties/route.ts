import { assertSameOrigin, requireSession } from "@/server/auth";
import { createParty, listParties, mergeParties, type PartyInput } from "@/server/mgmt/holders";
import { handle, json, readJson } from "@/server/http";

export async function GET(req: Request) {
  return handle(async () => json(await listParties((await requireSession(req)).session)));
}

/** Criar titular, ou fundir dois registos ({ merge: { keepId, mergeId } }). */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const { session } = await requireSession(req);
    const body = await readJson<PartyInput & { merge?: { keepId: string; mergeId: string } }>(req, 20_000);
    if (body.merge) return json(await mergeParties(session, body.merge.keepId, body.merge.mergeId));
    return json({ party: await createParty(session, body) }, 201);
  });
}
