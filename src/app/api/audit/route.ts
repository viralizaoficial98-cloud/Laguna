import type { NextRequest } from "next/server";
import { requireSession } from "@/server/auth";
import { queryAudit } from "@/server/mgmt/audit";
import { handle, json } from "@/server/http";

/** Consulta da auditoria (só leitura). */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const p = req.nextUrl.searchParams;
    return json({ rows: await queryAudit((await requireSession(req)).session, { source: p.get("source") ?? undefined, text: p.get("q") ?? undefined, from: p.get("from") ?? undefined, to: p.get("to") ?? undefined, take: Number(p.get("take") ?? 300) }) });
  });
}
