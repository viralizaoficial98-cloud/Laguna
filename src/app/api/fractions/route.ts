import { requireSession } from "@/server/auth";
import { listFractions } from "@/server/mgmt/holders";
import { handle, json } from "@/server/http";

export async function GET(req: Request) {
  return handle(async () => json({ fractions: await listFractions((await requireSession(req)).session) }));
}
