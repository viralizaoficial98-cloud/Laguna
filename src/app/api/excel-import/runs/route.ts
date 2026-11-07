import { requireSession } from "@/server/auth";
import { listImportRuns } from "@/server/mgmt/excel-import";
import { handle, json } from "@/server/http";

export async function GET(req: Request) {
  return handle(async () => json({ runs: await listImportRuns((await requireSession(req)).session) }));
}
