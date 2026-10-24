import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { requireSession } from "@/server/auth";
import { loadState, currentVersion } from "@/server/state";
import { projectFor } from "@/server/projection";
import { runAction } from "@/server/actions";
import { handle, json } from "@/server/http";

/** Estado de negócio visível para o perfil autenticado (leitura consistente numa transacção). */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const { session } = await requireSession(req);
    const known = Number(req.nextUrl.searchParams.get("v") ?? NaN);
    const read = () =>
      prisma.$transaction(async (tx) => {
        const version = await currentVersion(tx);
        if (version === known) return { version, state: null };
        return { version, state: await loadState(tx) };
      });
    let r = await read();
    if (!r.state) return json({ unchanged: true, version: r.version });
    // reservas provisórias não pagas expiram ao fim do prazo configurado
    const now = Date.now();
    if (r.state.reservations.some((x) => x.status === "pendente_pagamento" && x.expiresAt && new Date(x.expiresAt).getTime() < now)) {
      await runAction(session, "expireReservations", []).catch(() => undefined);
      r = await read();
    }
    return json({ version: r.version, state: projectFor(session, r.state!) });
  });
}
