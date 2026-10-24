/**
 * Serviço de autenticação (cliente) — chama a API do servidor. As credenciais nunca ficam no browser:
 * a sessão é um cookie httpOnly emitido pelo servidor.
 */
import type { Session } from "@/types";

export class AuthError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new AuthError(json.error ?? "Não foi possível concluir o pedido.", res.status);
  return json as T;
}

export async function login(email: string, password: string): Promise<Session> {
  return (await post<{ session: Session }>("/api/auth/login", { email, password })).session;
}

export async function logout(): Promise<void> {
  await post("/api/auth/logout").catch(() => undefined);
}

export async function requestPasswordReset(email: string) {
  return post<{ message: string }>("/api/auth/forgot", { email });
}

export async function setPasswordWithToken(token: string, password: string) {
  return post<{ ok: true; email: string }>("/api/auth/reset", { token, password });
}

export async function changePassword(current: string, next: string) {
  return post<{ ok: true }>("/api/auth/change-password", { current, next });
}
