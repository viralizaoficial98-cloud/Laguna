import type { NextRequest } from "next/server";
import { inspectToken } from "@/server/auth";
import { handle, json } from "@/server/http";

/** Verifica uma ligação de activação/redefinição (sem a consumir). */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const t = await inspectToken(req.nextUrl.searchParams.get("token") ?? "");
    if (!t) return json({ valid: false });
    const [local, domain] = t.user.email.split("@");
    return json({ valid: true, type: t.type, name: t.user.name, email: `${local.slice(0, 2)}***@${domain}`, expiresAt: t.expiresAt.toISOString() });
  });
}
