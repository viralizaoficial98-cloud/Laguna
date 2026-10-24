/**
 * Envio de email (opcional). Só é usado quando SMTP_HOST está configurado; caso contrário, as
 * ligações de activação/redefinição são entregues pelo fluxo administrativo (mostradas uma vez a
 * quem tem permissão, para entrega segura ao titular).
 */
import nodemailer from "nodemailer";

export const mailEnabled = () => !!process.env.SMTP_HOST;

export async function sendMail(to: string, subject: string, text: string) {
  if (!mailEnabled()) return false;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  await transport.sendMail({ from: process.env.SMTP_FROM ?? process.env.SMTP_USER, to, subject, text });
  return true;
}
