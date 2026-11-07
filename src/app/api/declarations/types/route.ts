import { assertSameOrigin, requireSession } from "@/server/auth";
import { listTypes, saveType } from "@/server/mgmt/declarations";
import { handle, json, readJson } from "@/server/http";

export async function GET(req: Request) {
  return handle(async () => json({ types: await listTypes((await requireSession(req)).session) }));
}

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const { session } = await requireSession(req);
    return json({ type: await saveType(session, await readJson(req, 40_000)) });
  });
}
