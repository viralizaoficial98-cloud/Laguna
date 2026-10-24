import { assertSameOrigin, requireSession } from "@/server/auth";
import { runAction } from "@/server/actions";
import { ActionError } from "@/server/errors";
import { projectFor } from "@/server/projection";
import { prisma } from "@/server/db";
import { loadState, currentVersion } from "@/server/state";
import { handle, json, readJson } from "@/server/http";

/**
 * Executa uma acção de negócio com a sessão autenticada. Em caso de recusa (permissão, regra de
 * negócio, conflito de concorrência), devolve o erro e o estado actual para o cliente se repor.
 */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const { session } = await requireSession(req);
    const body = await readJson<{ name?: string; args?: unknown[]; seed?: string }>(req);
    try {
      const r = await runAction(session, String(body.name ?? ""), body.args ?? [], body.seed);
      return json({ ok: true, version: r.version, state: projectFor(session, r.state) });
    } catch (e) {
      const err = e instanceof ActionError ? e : new ActionError("Erro ao processar a operação.", 500);
      const snap = await prisma.$transaction(async (tx) => ({ version: await currentVersion(tx), state: await loadState(tx) })).catch(() => null);
      return json({ error: err.message, ...(snap ? { version: snap.version, state: projectFor(session, snap.state) } : {}) }, err.status);
    }
  });
}
