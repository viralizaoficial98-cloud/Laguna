import type { NextRequest } from "next/server";
import { verifyByCode } from "@/server/mgmt/declarations";
import { handle, json } from "@/server/http";

/** Verificação pública da autenticidade de uma declaração (código QR). */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const r = await verifyByCode((req.nextUrl.searchParams.get("codigo") ?? "").toUpperCase());
    return json(r ? { valid: true, ...r } : { valid: false });
  });
}
