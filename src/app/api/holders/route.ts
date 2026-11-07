import { assertSameOrigin, requireSession } from "@/server/auth";
import { assignHolder, endHolder, type HolderRole, type PartyInput } from "@/server/mgmt/holders";
import { handle, json, readJson } from "@/server/http";

/** Associar/substituir proprietário ou inquilino ({ op: "assign" }) ou encerrar ({ op: "end" }). */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const { session } = await requireSession(req);
    const b = await readJson<{ op?: "assign" | "end"; apartmentId: string; role: HolderRole; partyId?: string; party?: PartyInput; from?: string; notes?: string; reason?: string; to?: string }>(req, 20_000);
    if (b.op === "end") return json(await endHolder(session, b.apartmentId, b.role, b.reason ?? "", b.to));
    return json(await assignHolder(session, b));
  });
}
