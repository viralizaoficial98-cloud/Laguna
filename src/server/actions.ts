/**
 * Execução autoritativa das acções de negócio no servidor.
 * 1. trinco de escrita (serializa escritas concorrentes)
 * 2. carrega o estado da base de dados
 * 3. executa a acção do motor de domínio com a sessão autenticada (permissões + regras)
 * 4. grava as diferenças e as restrições de exclusividade na mesma transacção
 */
import { createStore } from "zustand/vanilla";
import { createActions, runWithContext, type DemoActions, type DemoData, type DomainSet } from "@/domain/engine";
import type { Session } from "@/types";
import { PermissionError } from "@/config/permissions";
import { prisma } from "./db";
import { acquireWriteLock, bumpVersion, loadState, persistDiff, ConflictError, isTransientConflict } from "./state";
import { MappingError } from "./mapping";
import { validateActionArgs } from "./validation";
import { ActionError } from "./errors";

/** Acções que o cliente pode invocar (resetDemo nunca é exposta). */
export const ALLOWED_ACTIONS = new Set<keyof DemoActions>([
  "saveApartment",
  "deleteApartment",
  "saveResident",
  "deleteResident",
  "updateSettings",
  "emitQuotas",
  "submitPayment",
  "reviewPayment",
  "registerPayment",
  "addExpense",
  "deleteExpense",
  "saveHall",
  "requestReservation",
  "submitReservationPayment",
  "reviewReservationPayment",
  "cancelReservation",
  "updateReservationGuests",
  "expireReservations",
  "proposeCharge",
  "decideCharge",
  "requestMoveOut",
  "runFinancialCheck",
  "saveOperationalCheck",
  "authorizeMoveOut",
  "completeMoveOut",
  "cancelMoveOut",
  "saveCircular",
  "deleteCircular",
  "saveNotice",
  "deleteNotice",
  "saveVisit",
  "cancelVisit",
  "checkGuest",
  "saveOccurrence",
  "reportOccurrence",
  "updateOccurrence",
  "addOccurrenceNote",
  "saveElevator",
  "deleteElevator",
  "setElevatorStatus",
  "saveOpsTask",
  "deleteOpsTask",
  "addDocument",
  "deleteDocument",
  "markNotificationsRead",
]);

export { ActionError };

/** Remove conteúdos de ficheiros embebidos: os anexos têm de ser enviados por /api/files. */
function stripInline<T>(v: T): T {
  if (Array.isArray(v)) return v.map(stripInline) as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) if (!(k === "dataUrl" && typeof x === "string")) out[k] = stripInline(x);
    return out as T;
  }
  return v;
}

export async function runAction(session: Session, name: string, args: unknown[], seed?: string) {
  if (!ALLOWED_ACTIONS.has(name as keyof DemoActions)) throw new ActionError("Operação desconhecida.", 400);
  if (!Array.isArray(args)) throw new ActionError("Argumentos inválidos.", 400);
  if (seed !== undefined && !/^[a-z0-9]{6,16}$/.test(seed)) throw new ActionError("Identificador da operação inválido.", 400);
  // JSON converte argumentos `undefined` em `null`: repõe `undefined` e retira os finais
  const normalized = args.map((a) => (a === null ? undefined : a));
  while (normalized.length && normalized[normalized.length - 1] === undefined) normalized.pop();
  const clean = stripInline(normalized);
  validateActionArgs(name, clean);

  const started = Date.now();
  let changes = 0;
  const attempt = () =>
    prisma.$transaction(
      async (tx) => {
        await acquireWriteLock(tx);
        const before = await loadState(tx);
        const store = createStore<DemoData & DemoActions>()((set, get) => ({ ...before, ...createActions(set as unknown as DomainSet, get) }));
        const value = runWithContext({ session, seed }, () => (store.getState()[name as keyof DemoActions] as (...a: unknown[]) => unknown)(...clean));
        const after = store.getState();
        changes = await persistDiff(tx, before, after);
        const version = changes ? await bumpVersion(tx) : (await tx.appMeta.findUnique({ where: { id: 1 } }))?.dataVersion ?? 0;
        return { value, state: after as DemoData, version };
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
  try {
    let result: Awaited<ReturnType<typeof attempt>> | undefined;
    // repete em caso de conflito transitório (a operação seguinte vê o estado já actualizado)
    for (let i = 0; ; i++) {
      try {
        result = await attempt();
        break;
      } catch (e) {
        if (i >= 3 || !isTransientConflict(e)) throw e;
        await new Promise((r) => setTimeout(r, 50 * (i + 1) + Math.random() * 50));
      }
    }
    await logAction(session, name, true, undefined, Date.now() - started, changes);
    return result!;
  } catch (e) {
    const err = toActionError(e);
    await logAction(session, name, false, err.message, Date.now() - started, 0);
    throw err;
  }
}

export function toActionError(e: unknown): ActionError {
  if (e instanceof ActionError) return e;
  if (e instanceof PermissionError) return new ActionError("Operação não autorizada para o seu perfil.", 403);
  if (e instanceof ConflictError) return new ActionError(e.message, 409);
  if (e instanceof MappingError) return new ActionError(e.message, 422);
  const code = (e as { code?: string })?.code;
  if (code === "P2003") return new ActionError("Operação recusada: o registo está associado a outros dados (histórico preservado).", 409);
  if (code === "P2002") return new ActionError("Operação recusada: já existe um registo com estes dados.", 409);
  if (code === "P2028" || code === "P2034" || isTransientConflict(e)) return new ActionError("O servidor está ocupado. Tente novamente.", 503);
  if (e instanceof Error && !code && !(e instanceof TypeError) && !(e instanceof RangeError) && !(e instanceof ReferenceError)) return new ActionError(e.message, 422);
  console.error("[actions] erro inesperado", e);
  return new ActionError("Erro interno ao gravar a operação.", 500);
}

async function logAction(session: Session, action: string, ok: boolean, error: string | undefined, durationMs: number, changes: number) {
  try {
    await prisma.actionLog.create({ data: { userId: session.userId, role: session.role, action, ok, error: error?.slice(0, 500), durationMs, changes } });
  } catch {
    /* o registo técnico nunca impede a operação */
  }
}
