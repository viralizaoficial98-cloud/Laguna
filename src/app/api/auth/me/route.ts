import { getSession } from "@/server/auth";
import { handle, json } from "@/server/http";

export async function GET(req: Request) {
  return handle(async () => {
    const s = await getSession(req);
    if (!s) return json({ session: null });
    return json({ session: s.session });
  });
}
