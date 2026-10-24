import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, hashPassword, passwordProblem, requireSession, verifyPassword } from "@/server/auth";
import { ActionError } from "@/server/errors";
import { handle, json, readJson } from "@/server/http";

/** Alteração da palavra-passe pelo próprio utilizador (exige a actual). Termina as outras sessões. */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const s = await requireSession(req);
    const { current, next } = await readJson<{ current?: string; next?: string }>(req, 5_000);
    if (!s.user.passwordHash || !(await verifyPassword(s.user.passwordHash, String(current ?? "")))) throw new ActionError("A palavra-passe actual não está correcta.", 400);
    const problem = passwordProblem(String(next ?? ""), s.user.email);
    if (problem) throw new ActionError(problem, 400);
    if (current === next) throw new ActionError("A nova palavra-passe deve ser diferente da actual.", 400);
    await prisma.user.update({ where: { id: s.user.id }, data: { passwordHash: await hashPassword(String(next)), passwordChangedAt: new Date() } });
    await prisma.authSession.deleteMany({ where: { userId: s.user.id, id: { not: s.sessionId } } });
    await prisma.userAuditLog.create({ data: { actorId: s.user.id, actorName: s.user.name, targetId: s.user.id, targetName: s.user.name, action: "palavra_passe_alterada", ip: clientIp(req) } });
    return json({ ok: true });
  });
}
