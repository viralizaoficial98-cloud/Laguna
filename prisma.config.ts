import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // a URL só é necessária para comandos que acedem à base de dados (migrate deploy/status)
  datasource: { url: process.env.DATABASE_URL ?? "mysql://user:password@localhost:3306/database" },
});
