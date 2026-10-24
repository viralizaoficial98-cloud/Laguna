import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { cookieOptions, getSession, SESSION_COOKIE } from "@/server/auth";
import { handle, noStore } from "@/server/http";

export async function POST(req: Request) {
  return handle(async () => {
    const s = await getSession(req);
    if (s) await prisma.authSession.delete({ where: { id: s.sessionId } }).catch(() => undefined);
    const res = NextResponse.json({ ok: true }, { headers: noStore });
    res.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
    return res;
  });
}
