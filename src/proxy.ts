import { NextResponse, type NextRequest } from "next/server";

/**
 * Redirecciona para o login quem acede à área privada sem cookie de sessão.
 * A validação real da sessão e das permissões é feita em cada pedido à API.
 */
export function proxy(req: NextRequest) {
  if (!req.cookies.get("laguna_session")?.value) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/painel/:path*"] };
