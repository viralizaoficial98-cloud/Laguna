/**
 * Importação inicial / incremental para MySQL — idempotente, nunca elimina registos.
 *
 *   npm run db:import                       # pré-visualização (não grava) dos dados actuais do frontend
 *   npm run db:import -- --apply            # insere apenas os registos novos
 *   npm run db:import -- --file=export.json # usa uma exportação do navegador como fonte
 *   npm run db:import -- --apply --overwrite-conflicts --yes   # substitui também os conflitos (confirmação explícita)
 *
 * O relatório completo é gravado em backups/import-report-<data>.json.
 */
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { initialAll } from "@/domain/engine";
import { createPrisma } from "@/server/db";
import { applyImport, parseBrowserExport, planImport } from "@/server/importer";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");

async function main() {
  const prisma = createPrisma();
  const file = opt("file");
  const data = file ? parseBrowserExport(JSON.parse(await readFile(file, "utf8"))) : initialAll();
  const source = file ? `ficheiro:${file}` : "frontend (src/data)";
  const plan = await prisma.$transaction((tx) => planImport(tx, data), { timeout: 120_000 });

  console.log(`\nFonte: ${source}`);
  console.log("Colecção".padEnd(16), "origem", "na BD", "novos", "iguais", "conflitos", "rejeitados");
  for (const [c, n] of Object.entries(plan.counts)) console.log(c.padEnd(16), String(n.incoming).padStart(6), String(n.existing).padStart(5), String(n.new).padStart(5), String(n.identical).padStart(6), String(n.conflicts).padStart(9), String(n.rejected).padStart(10));
  console.log(`Configuração: ${plan.settings} · anexos com conteúdo: ${plan.files.inline} · anexos sem conteúdo (só metadados): ${plan.files.withoutContent}`);
  if (plan.unknownFields.length) console.log("Campos não previstos (não importados):", plan.unknownFields.join(", "));
  if (plan.rejected.length) console.log(`Rejeitados: ${plan.rejected.length} (ver relatório)`);

  await mkdir("backups", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = `backups/import-report-${stamp}.json`;
  let result: unknown = null;

  if (flag("apply")) {
    const overwriteAll = flag("overwrite-conflicts");
    if (overwriteAll && !flag("yes")) throw new Error("--overwrite-conflicts exige confirmação explícita com --yes.");
    result = await prisma.$transaction(
      (tx) => applyImport(tx, data, { overwrite: overwriteAll ? plan.conflicts.map((c) => `${c.collection}:${c.id}`) : [], applySettings: overwriteAll, by: null, source }),
      { timeout: 300_000, maxWait: 30_000 },
    );
    console.log("\nImportação concluída:", JSON.stringify({ inserted: (result as { inserted: number }).inserted, updated: (result as { updated: number }).updated, rejected: (result as { rejected: number }).rejected }));
  } else {
    console.log("\nPré-visualização apenas — nada foi gravado. Utilize --apply para importar.");
  }
  await writeFile(reportPath, JSON.stringify({ source, plan, result }, null, 2));
  console.log(`Relatório: ${reportPath}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Erro:", e instanceof Error ? e.message : e);
  process.exit(1);
});
