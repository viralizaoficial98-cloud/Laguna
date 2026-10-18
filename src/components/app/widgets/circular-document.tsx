import Image from "next/image";
import type { Circular } from "@/types";
import { siteConfig } from "@/config/site";
import { formatDate } from "@/lib/utils";

/** Modelo visual da circular institucional (A4), pronto para impressão. */
export function CircularDocument({ circular }: { circular: Pick<Circular, "number" | "date" | "subject" | "body" | "author" | "authorTitle" | "audience" | "status"> }) {
  return (
    <article className="print-area relative mx-auto w-full max-w-[794px] overflow-hidden bg-white px-8 py-10 text-graphite-800 shadow-lift sm:px-14 sm:py-14" style={{ minHeight: 900 }}>
      {circular.status === "rascunho" && (
        <span className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[30deg] font-display text-[7rem] font-semibold text-graphite-100 select-none">RASCUNHO</span>
      )}
      <header className="relative flex items-start justify-between gap-6 border-b-2 border-navy-900 pb-6">
        <div>
          <Image src={siteConfig.logo.color} alt="Residencial Laguna" width={siteConfig.logo.width} height={siteConfig.logo.height} className="h-12 w-auto" />
          <p className="mt-2 text-[10px] tracking-[0.25em] text-graphite-500 uppercase">Administração do Condomínio · {siteConfig.location.district}, {siteConfig.location.city}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] tracking-[0.2em] text-gold-700 uppercase">Circular</p>
          <p className="font-display text-3xl whitespace-nowrap text-navy-900">N.º {circular.number || "—"}</p>
          <p className="text-xs text-graphite-500">{circular.date ? formatDate(circular.date, { day: "2-digit", month: "long", year: "numeric" }) : "—"}</p>
        </div>
      </header>

      <div className="relative mt-8 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <span className="font-semibold text-navy-900">Para:</span>
        <span>{circular.audience || "—"}</span>
        <span className="font-semibold text-navy-900">Assunto:</span>
        <span className="font-semibold">{circular.subject || "—"}</span>
      </div>

      <div className="relative mt-8 text-[15px] leading-7 whitespace-pre-line">{circular.body || "O corpo da circular aparecerá aqui."}</div>

      <footer className="relative mt-16">
        <p className="text-sm">Talatona, {circular.date ? formatDate(circular.date, { day: "numeric", month: "long", year: "numeric" }) : "—"}</p>
        <div className="mt-14 w-64 border-t border-graphite-400 pt-2">
          <p className="text-sm font-semibold text-navy-900">{circular.author}</p>
          <p className="text-xs text-graphite-500">{circular.authorTitle}</p>
        </div>
        <p className="mt-2 text-[10px] text-graphite-400">Área de assinatura — sem validade de assinatura digital nesta fase.</p>
      </footer>
      <div className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-navy-900 via-gold-500 to-navy-900" />
    </article>
  );
}
