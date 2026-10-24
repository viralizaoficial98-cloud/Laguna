import { assertSameOrigin, clientIp, consumeToken } from "@/server/auth";
import { handle, json, readJson } from "@/server/http";

/** Define a palavra-passe com um token de activação ou de redefinição (utilização única). */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const { token, password } = await readJson<{ token?: string; password?: string }>(req, 5_000);
    const user = await consumeToken(String(token ?? ""), String(password ?? ""), clientIp(req));
    return json({ ok: true, email: user.email });
  });
}
