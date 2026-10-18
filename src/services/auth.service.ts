/**
 * Serviço de autenticação DEMONSTRATIVO (sem backend).
 * Futuro: substituir por chamada a `POST /api/auth/login` com sessão no servidor.
 */
import type { Session } from "@/types";
import { demoUsers } from "@/data/users";

export class AuthError extends Error {}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function login(email: string, password: string): Promise<Session> {
  await wait(650);
  const user = demoUsers.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user || user.password !== password) {
    throw new AuthError("Email ou palavra-passe inválidos.");
  }
  if (user.status !== "activo") throw new AuthError("Esta conta está inactiva.");
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
    residentId: user.residentId,
    startedAt: new Date().toISOString(),
  };
}

export async function logout(): Promise<void> {
  await wait(150);
}
