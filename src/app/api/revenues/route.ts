import type { NextRequest } from "next/server";
import { assertSameOrigin, requireSession } from "@/server/auth";
import { createRevenue, listRevenues } from "@/server/mgmt/budget";
import { handle, json, readJson } from "@/server/http";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const y = req.nextUrl.searchParams.get("year");
    return json({ revenues: await listRevenues((await requireSession(req)).session, y ? Number(y) : undefined) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const { session } = await requireSession(req);
    return json(await createRevenue(session, await readJson(req, 10_000)), 201);
  });
}
