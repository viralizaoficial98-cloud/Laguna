import Image from "next/image";
import type { Circular } from "@/types";
import { siteConfig } from "@/config/site";
import { formatLongDatePT } from "@/lib/utils";
import { recipientLines } from "@/lib/circular";

export type CircularDocData = Pick<Circular, "number" | "date" | "subject" | "body" | "closing" | "author" | "recipients" | "status">;

function paragraphs(text?: string) {
  return (text ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Pré-visualização A4 da circular, fiel ao modelo oficial "CIRCULAR N.º 04/ADMLR/2025".
 * O PDF descarregável é gerado por src/lib/circular-pdf.ts com a mesma estrutura.
 */
export function CircularDocument({ circular }: { circular: CircularDocData }) {
  const list = circular.recipients.mode === "seleccao" && circular.recipients.listInBody ? recipientLines(circular.recipients) : [];
  return (
    <article
      className="print-area relative mx-auto flex w-full max-w-[794px] flex-col bg-white px-[9%] pt-[5%] pb-[4%] text-[#191919] shadow-lift"
      style={{ aspectRatio: "210 / 297", fontFamily: "Helvetica, Arial, sans-serif" }}
    >
      {circular.status === "rascunho" && (
        <span className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[30deg] text-[5rem] font-semibold text-graphite-100 select-none">RASCUNHO</span>
      )}
      <header className="relative">
        <Image src={siteConfig.logo.color} alt="Residencial Laguna" width={siteConfig.logo.width} height={siteConfig.logo.height} className="h-auto w-[30%] min-w-[120px]" />
        <p className="mt-1 text-[15px]">Administração</p>
        <div className="mt-1 h-px bg-[#282828]" />
      </header>

      <div className="relative mt-[6%] text-center">
        <p className="text-[16px] font-bold">CIRCULAR N.º {circular.number || "—"}</p>
        <p className="mx-auto mt-2 max-w-[90%] text-[15px]">{circular.subject || "Assunto da circular"}</p>
      </div>

      <div className="relative mt-[5%] flex-1 space-y-3 text-justify text-[14px] leading-[1.55]">
        {paragraphs(circular.body).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {paragraphs(circular.body).length === 0 && <p className="text-graphite-400 italic">O texto da comunicação aparecerá aqui.</p>}
        {list.length > 0 && (
          <ul className="space-y-1 py-1 text-left text-[15px]">
            {list.map((l) => (
              <li key={l} className="flex gap-3">
                <span>•</span>
                {l}
              </li>
            ))}
          </ul>
        )}
        {paragraphs(circular.closing).map((p, i) => (
          <p key={`c${i}`}>{p}</p>
        ))}

        <p className="pt-4 text-left">Luanda, aos {circular.date ? formatLongDatePT(circular.date) : "—"}.</p>

        <div className="ml-auto mr-[12%] w-[44%] pt-3 text-center">
          <p>{siteConfig.administrator.signatureTitle}</p>
          <div className="mt-1 flex h-20 items-center justify-center rounded-md border border-dashed border-graphite-300 text-[10px] text-graphite-400">Espaço reservado para assinatura e carimbo</div>
          <p className="mt-2 font-bold text-navy-900">{circular.author || siteConfig.administrator.name}</p>
        </div>
      </div>

      <footer className="relative mt-4 text-[9.5px] text-[#205caa]">
        {siteConfig.letterheadName}, {siteConfig.location.street}, TALATONA – LUANDA – ANGOLA{siteConfig.contacts.phone ? ` | M. ${siteConfig.contacts.phone}` : ""}
      </footer>
    </article>
  );
}
