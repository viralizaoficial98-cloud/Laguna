import type { Apartment, Circular, CircularRecipients } from "@/types";
import { siteConfig } from "@/config/site";

/** "04/ADMLR/2026" */
export function circularNumber(sequence: number, year: number) {
  return `${String(sequence).padStart(2, "0")}/${siteConfig.circularRef}/${year}`;
}

/** Próximo número sequencial do ano, sem duplicações. */
export function nextCircularSequence(circulars: Pick<Circular, "year" | "sequence">[], year: number) {
  return Math.max(0, ...circulars.filter((c) => c.year === year).map((c) => c.sequence)) + 1;
}

/** Linhas da lista de destinatários, no formato do modelo oficial: "BLOCO 06 – 101-102-201". */
export function recipientLines(r: CircularRecipients) {
  return Object.keys(r.blocks)
    .sort()
    .map((b) => {
      const apts = [...r.blocks[b]].sort();
      return `BLOCO ${b} – ${apts.length ? apts.join("-") : "todos os apartamentos"}`;
    });
}

export function recipientSummary(r: CircularRecipients) {
  if (r.mode === "todos") return "Todos os condóminos";
  const blocks = Object.keys(r.blocks).sort();
  if (blocks.length === 0) return "Sem destinatários seleccionados";
  const apts = blocks.reduce((n, b) => n + r.blocks[b].length, 0);
  return `${blocks.length === 1 ? "Bloco" : "Blocos"} ${blocks.join(", ")}${apts ? ` · ${apts} apartamento(s)` : ""}`;
}

/** Indica se uma circular se destina a uma fracção. */
export function circularTargets(c: Pick<Circular, "recipients">, apt?: Pick<Apartment, "block" | "number">) {
  if (c.recipients.mode === "todos") return true;
  if (!apt) return false;
  const list = c.recipients.blocks[apt.block];
  return !!list && (list.length === 0 || list.includes(apt.number));
}

export function circularFileName(c: Pick<Circular, "number">) {
  return `Circular_N_${c.number.replace(/\//g, "_")}.pdf`;
}
