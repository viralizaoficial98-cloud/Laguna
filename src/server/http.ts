import { ActionError } from "./errors";
import { toActionError } from "./actions";

export const noStore = { "Cache-Control": "no-store" };

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(data, { status, headers: { ...noStore, ...headers } });
}

/** Envolve um handler: converte erros em respostas JSON com o código HTTP adequado. */
export async function handle(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (e) {
    const err = e instanceof ActionError ? e : toActionError(e);
    if (err.status >= 500) console.error("[api]", e);
    return json({ error: err.message }, err.status);
  }
}

export async function readJson<T = Record<string, unknown>>(req: Request, maxBytes = 300_000): Promise<T> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new ActionError("Pedido demasiado grande.", 413);
  const text = await req.text();
  if (text.length > maxBytes) throw new ActionError("Pedido demasiado grande.", 413);
  try {
    return JSON.parse(text || "{}") as T;
  } catch {
    throw new ActionError("JSON inválido.", 400);
  }
}
