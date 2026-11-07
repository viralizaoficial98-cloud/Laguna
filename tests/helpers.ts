/** Utilitários comuns aos testes de integração (servidor em execução + base de dados de TESTE). */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma } from "@/server/db";
import { issueToken } from "@/server/auth";

export const BASE = process.env.BASE_URL ?? "http://localhost:3100";
export const counts = { pass: 0, fail: 0 };
export const ok = (name: string, cond: unknown, extra = "") => {
  if (cond) counts.pass++;
  else counts.fail++;
  console.log(`${cond ? "✔" : "✘"} ${name}${!cond && extra ? ` — ${extra}` : ""}`);
};
export const pw = () => `Teste-${randomBytes(6).toString("hex")}-9`;

export class Client {
  cookie = "";
  constructor(public label: string) {}
  async req(path: string, init: RequestInit & { json?: unknown } = {}) {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>), ...(this.cookie ? { cookie: this.cookie } : {}) };
    let body = init.body;
    if (init.json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(init.json);
    }
    const res = await fetch(BASE + path, { ...init, headers, body, redirect: "manual" });
    const set = res.headers.get("set-cookie");
    if (set) {
      const m = /laguna_session=([^;]*)/.exec(set);
      if (m) this.cookie = m[1] ? `laguna_session=${m[1]}` : "";
    }
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {
      /* binário */
    }
    return { status: res.status, data, text, headers: res.headers };
  }
  login(email: string, password: string) {
    return this.req("/api/auth/login", { method: "POST", json: { email, password } });
  }
  action(name: string, ...args: unknown[]) {
    return this.req("/api/actions", { method: "POST", json: { name, args } });
  }
  async state() {
    return (await this.req("/api/state")).data.state as Record<string, never[]> & Record<string, unknown>;
  }
}

export async function activate(email: string, password: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { email } });
  if (u.status === "bloqueado" || u.status === "inactivo") await prisma.user.update({ where: { id: u.id }, data: { status: u.passwordHash ? "activo" : "pendente_activacao", lockedUntil: null, failedLogins: 0 } });
  const t = await issueToken(u.id, u.passwordHash ? "reset" : "activation", "testes");
  const r = await new Client("anon").req("/api/auth/reset", { method: "POST", json: { token: t.token, password } });
  return r.status === 200;
}

// PNG 1×1 válido
export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

export async function upload(c: Client, buf: Buffer, name: string, type: string) {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(buf)], name, { type }));
  return c.req("/api/files", { method: "POST", body: form });
}

