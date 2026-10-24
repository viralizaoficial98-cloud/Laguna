import { NextResponse } from "next/server";
import { assertSameOrigin, attemptLogin, cookieOptions, createSession, SESSION_COOKIE, toSession } from "@/server/auth";
import { handle, json, noStore, readJson } from "@/server/http";

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const body = await readJson<{ email?: string; password?: string }>(req, 10_000);
    const r = await attemptLogin(String(body.email ?? ""), String(body.password ?? ""), req);
    if (!r.ok) return json({ error: r.error }, r.status);
    const { token, maxAge } = await createSession(r.user.id, req);
    const res = NextResponse.json({ session: toSession(r.user, new Date()) }, { headers: noStore });
    res.cookies.set(SESSION_COOKIE, token, cookieOptions(maxAge));
    return res;
  });
}
