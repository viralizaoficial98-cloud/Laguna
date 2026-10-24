import { prisma } from "@/server/db";
import { appUrl, assertSameOrigin, clientIp, issueToken } from "@/server/auth";
import { handle, json, readJson } from "@/server/http";
import { mailEnabled, sendMail } from "@/server/mailer";

const MESSAGE = "Se o email estiver registado, será enviada uma ligação de redefinição. Caso não a receba, contacte a gestão do condomínio.";

/** Pedido de redefinição pelo próprio utilizador. A resposta é sempre igual (não revela contas). */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const { email } = await readJson<{ email?: string }>(req, 5_000);
    const e = String(email ?? "").trim().toLowerCase().slice(0, 190);
    const ip = clientIp(req);
    const recent = await prisma.userAuditLog.count({ where: { action: "pedido_redefinicao", ip, at: { gte: new Date(Date.now() - 15 * 60_000) } } });
    if (recent >= 5) return json({ message: MESSAGE });
    const user = e ? await prisma.user.findUnique({ where: { email: e } }) : null;
    if (user && (user.status === "activo" || user.status === "pendente_activacao")) {
      let emailed = false;
      if (mailEnabled()) {
        const t = await issueToken(user.id, user.passwordHash ? "reset" : "activation", user.id);
        emailed = await sendMail(user.email, "Portal Residencial Laguna — redefinição de palavra-passe", `Olá ${user.name},\n\nPara definir uma nova palavra-passe utilize a ligação (válida durante ${t.expiresHours} horas, utilização única):\n\n${appUrl(req)}${t.path}\n\nSe não pediu esta operação, ignore este email.`).catch(() => false);
      }
      // sem email configurado: o pedido fica visível na Gestão de Utilizadores para entrega administrativa
      await prisma.userAuditLog.create({ data: { actorId: user.id, actorName: user.name, targetId: user.id, targetName: user.name, action: "pedido_redefinicao", after: JSON.stringify({ emailed }), ip } });
    } else {
      await prisma.userAuditLog.create({ data: { actorName: "Anónimo", action: "pedido_redefinicao_sem_conta", ip } });
    }
    return json({ message: MESSAGE });
  });
}
