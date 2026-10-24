import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

/** Configuração da ligação a partir de DATABASE_URL (mysql://utilizador:palavra-passe@host:3306/base). */
export function poolConfig(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL não está definida. Configure a variável de ambiente no servidor.");
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
    connectionLimit: Number(process.env.DB_POOL_SIZE ?? 5),
    // MySQL 8 (caching_sha2_password) sem TLS em localhost
    allowPublicKeyRetrieval: true,
    // devolver DATETIME como UTC
    timezone: "Z",
  };
}

export function createPrisma(url?: string) {
  return new PrismaClient({ adapter: new PrismaMariaDb(poolConfig(url)) });
}

const g = globalThis as unknown as { __lagunaPrisma?: PrismaClient };
export const prisma: PrismaClient = g.__lagunaPrisma ?? createPrisma();
if (process.env.NODE_ENV !== "production") g.__lagunaPrisma = prisma;

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
