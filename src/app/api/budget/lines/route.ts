import { assertSameOrigin, requireSession } from "@/server/auth";
import { addLine } from "@/server/mgmt/budget";
import { handle, json, readJson } from "@/server/http";

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const { session } = await requireSession(req);
    return json(await addLine(session, await readJson(req, 10_000)), 201);
  });
}
