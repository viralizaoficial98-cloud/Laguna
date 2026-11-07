import type { NextRequest } from "next/server";
import { requireSession } from "@/server/auth";
import { getBudget } from "@/server/mgmt/budget";
import { handle, json } from "@/server/http";

export async function GET(req: NextRequest) {
  return handle(async () => json(await getBudget((await requireSession(req)).session, Number(req.nextUrl.searchParams.get("year") ?? new Date().getFullYear()))));
}
