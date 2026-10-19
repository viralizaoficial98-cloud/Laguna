"use client";

/**
 * Geração da circular em PDF A4, fiel ao modelo "CIRCULAR N.º 04/ADMLR/2025":
 * logótipo + "Administração", linha divisória, título e assunto centrados,
 * corpo justificado, lista por bloco, data "Luanda, aos …", "O Administrador / José Leiria",
 * espaço para assinatura e carimbo, e rodapé institucional.
 *
 * Não reproduz assinaturas manuscritas nem carimbos: o espaço fica reservado.
 */
import type { Circular } from "@/types";
import { siteConfig } from "@/config/site";
import { formatLongDatePT } from "@/lib/utils";
import { circularFileName, recipientLines } from "@/lib/circular";

type CircularDoc = Pick<Circular, "number" | "subject" | "body" | "closing" | "date" | "recipients" | "author" | "status">;

const NAVY: [number, number, number] = [11, 31, 58];
const BRAND_BLUE: [number, number, number] = [32, 92, 170];

async function loadImage(src: string) {
  const res = await fetch(src);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export async function buildCircularPdf(c: CircularDoc) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const ML = 22;
  const MR = 22;
  const CW = W - ML - MR;
  const FOOTER_Y = H - 12;
  let y = 0;

  const logo = await loadImage(siteConfig.logo.color);

  const header = () => {
    const lw = 52;
    doc.addImage(logo, "PNG", ML - 1, 12, lw, (lw * siteConfig.logo.height) / siteConfig.logo.width);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.text("Administração", ML, 33);
    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.35);
    doc.line(ML, 36, W - MR, 36);
    footer();
  };

  const footer = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND_BLUE);
    const text = `${siteConfig.letterheadName}, ${siteConfig.location.street}, TALATONA – LUANDA – ANGOLA${siteConfig.contacts.phone ? `  |  M. ${siteConfig.contacts.phone}` : ""}`;
    doc.text(text, ML, FOOTER_Y);
    if (c.status === "rascunho") {
      doc.setFontSize(8);
      doc.setTextColor(170, 170, 170);
      doc.text("RASCUNHO — documento não publicado", W - MR, 33, { align: "right" });
    }
  };

  const ensure = (h: number) => {
    if (y + h > FOOTER_Y - 10) {
      doc.addPage();
      header();
      y = 48;
    }
  };

  const paragraph = (text: string, size = 11.5) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(25, 25, 25);
    const lh = size * 0.52;
    const lines: string[] = doc.splitTextToSize(text, CW);
    lines.forEach((line, i) => {
      ensure(lh);
      const words = line.trim().split(/\s+/);
      const last = i === lines.length - 1;
      // justificação manual: distribui o espaço em falta entre as palavras (excepto na última linha)
      if (!last && words.length > 1) {
        const wordsWidth = words.reduce((a, w) => a + doc.getTextWidth(w), 0);
        const gap = (CW - wordsWidth) / (words.length - 1);
        let x = ML;
        words.forEach((w) => {
          doc.text(w, x, y);
          x += doc.getTextWidth(w) + gap;
        });
      } else doc.text(line.trim(), ML, y);
      y += lh;
    });
    y += lh * 0.6;
  };

  header();

  // Título e assunto centrados
  y = 54;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(`CIRCULAR N.º ${c.number}`, W / 2, y, { align: "center" });
  y += 9;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12.5);
  const subj: string[] = doc.splitTextToSize(c.subject, CW - 10);
  subj.forEach((l) => {
    doc.text(l, W / 2, y, { align: "center" });
    y += 6.5;
  });
  y += 8;

  // Corpo
  c.body
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean)
    .forEach((p) => paragraph(p));

  // Lista de blocos/apartamentos
  if (c.recipients.mode === "seleccao" && c.recipients.listInBody) {
    const lines = recipientLines(c.recipients);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12.5);
    lines.forEach((l) => {
      ensure(7.5);
      doc.circle(ML + 3, y - 1.4, 0.9, "F");
      doc.text(l, ML + 9, y);
      y += 7.5;
    });
    y += 3;
  }

  if (c.closing?.trim()) {
    c.closing
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\n/g, " ").trim())
      .filter(Boolean)
      .forEach((p) => paragraph(p));
  }

  // Data e assinatura
  ensure(70);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11.5);
  doc.text(`Luanda, aos ${formatLongDatePT(c.date)}.`, ML, y);
  y += 14;

  const boxW = 70;
  const boxX = W / 2 - boxW / 2 + 8;
  doc.setFontSize(11.5);
  doc.text(siteConfig.administrator.signatureTitle, boxX + boxW / 2, y, { align: "center" });
  // espaço reservado para assinatura e carimbo
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.roundedRect(boxX, y + 3, boxW, 26, 2, 2, "S");
  doc.setLineDashPattern([], 0);
  doc.setFontSize(7.5);
  doc.setTextColor(150, 150, 150);
  doc.text("Espaço reservado para assinatura e carimbo", boxX + boxW / 2, y + 17, { align: "center" });
  doc.setFontSize(11.5);
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.text(c.author || siteConfig.administrator.name, boxX + boxW / 2, y + 36, { align: "center" });

  doc.setProperties({ title: `Circular N.º ${c.number}`, subject: c.subject, author: siteConfig.administrator.name, creator: "Portal Residencial Laguna" });
  return doc;
}

export async function downloadCircularPdf(c: CircularDoc) {
  const doc = await buildCircularPdf(c);
  doc.save(circularFileName(c));
}

export async function circularPdfUrl(c: CircularDoc) {
  const doc = await buildCircularPdf(c);
  return URL.createObjectURL(doc.output("blob"));
}
