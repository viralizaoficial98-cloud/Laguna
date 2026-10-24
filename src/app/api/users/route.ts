import { assertSameOrigin, clientIp, requireSession } from "@/server/auth";
import { createUser, listUsers, type UserInput } from "@/server/users";
import { handle, json, readJson } from "@/server/http";

export async function GET(req: Request) {
  return handle(async () => {
    const { session } = await requireSession(req);
    return json(await listUsers(session));
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const { session } = await requireSession(req);
    const body = await readJson<UserInput>(req, 10_000);
    return json({ user: await createUser(session, body, clientIp(req)) }, 201);
  });
}
