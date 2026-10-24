import { requireSession } from "@/server/auth";
import { readAuthorized } from "@/server/files";
import { handle } from "@/server/http";

/** Descarga/pré-visualização de um anexo, após verificação da sessão e do perfil. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { session } = await requireSession(req);
    const { id } = await ctx.params;
    const { file, data } = await readAuthorized(id, session);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": file.mime,
        "Content-Length": String(file.size),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    });
  });
}
