/**
 * Geração do PDF de declaração no SERVIDOR (jsPDF): a imagem de assinatura nunca é enviada ao browser.
 * Inclui logótipo, identificação do condomínio, número único, dados verificados, texto, assinatura e
 * código QR para verificação da autenticidade.
 */
import path from "node:path";
import { readFile } from "node:fs/promises";
import QRCode from "qrcode";
import { siteConfig } from "@/config/site";
import { formatLongDatePT } from "@/lib/utils";

const M = 20;
const W = 210;
const H = 297;
const NAVY: [number, number, number] = [11, 31, 58];

export interface DeclarationPdfInput {
  number: string;
  typeName: string;
  fields: [string, string][];
  body: string;
  issuedAt: Date;
  signer: { name: string; title: string; png: Buffer | null };
  verifyUrl: string;
  verificationCode: string;
}

async function logo() {
  const p = path.join(/* turbopackIgnore: true */ process.cwd(), "public", siteConfig.logo.color.replace(/^\//, ""));
  return `data:image/png;base64,${(await readFile(p)).toString("base64")}`;
}

export async function buildDeclarationPdf(d: DeclarationPdfInput): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setProperties({ title: `${d.typeName} ${d.number}`, subject: d.typeName, author: siteConfig.letterheadName, creator: "Portal Residencial Laguna" });
  doc.addImage(await logo(), "PNG", M, 12, 46, (46 * siteConfig.logo.height) / siteConfig.logo.width);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text("Administração", M, 30);
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`Documento N.º ${d.number}`, W - M, 16, { align: "right" });
  doc.text(siteConfig.letterheadName, W - M, 21, { align: "right" });
  doc.text(`${siteConfig.location.street}, ${siteConfig.location.district} — ${siteConfig.location.city}`, W - M, 26, { align: "right" });
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.35);
  doc.line(M, 33, W - M, 33);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(20, 20, 20);
  let y = 47;
  for (const l of doc.splitTextToSize(d.typeName.toUpperCase(), W - 2 * M) as string[]) {
    doc.text(l, W / 2, y, { align: "center" });
    y += 7;
  }
  y += 4;
  doc.setFontSize(10);
  for (const [k, v] of d.fields) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(k, M, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(25, 25, 25);
    const lines = doc.splitTextToSize(v, W - 2 * M - 52) as string[];
    lines.forEach((l, i) => doc.text(l, M + 52, y + i * 5.2));
    y += Math.max(1, lines.length) * 5.2 + 1.5;
  }
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(25, 25, 25);
  for (const para of d.body.split(/\n{2,}/)) {
    for (const l of doc.splitTextToSize(para.replace(/\n/g, " "), W - 2 * M) as string[]) {
      if (y > H - 75) {
        doc.addPage();
        y = 25;
      }
      doc.text(l, M, y);
      y += 6;
    }
    y += 3;
  }
  y = Math.max(y + 4, 170);
  if (y > H - 80) {
    doc.addPage();
    y = 30;
  }
  doc.text(`Luanda, aos ${formatLongDatePT(d.issuedAt.toISOString().slice(0, 10))}.`, M, y);
  const cx = W - M - 40;
  doc.text(d.signer.title, cx, y + 12, { align: "center" });
  if (d.signer.png) {
    const dims = { w: d.signer.png.readUInt32BE(16), h: d.signer.png.readUInt32BE(20) };
    const w = 50;
    const h = Math.min(24, (w * dims.h) / dims.w);
    doc.addImage(`data:image/png;base64,${d.signer.png.toString("base64")}`, "PNG", cx - w / 2, y + 15, w, h);
  }
  doc.setDrawColor(150, 150, 150);
  doc.line(cx - 32, y + 41, cx + 32, y + 41);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text(d.signer.name, cx, y + 47, { align: "center" });

  const qr = await QRCode.toDataURL(d.verifyUrl, { margin: 1, width: 240, errorCorrectionLevel: "M" });
  doc.addImage(qr, "PNG", M, H - 52, 28, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(["Verificação da autenticidade:", d.verifyUrl.replace(/\?.*$/, ""), `Código: ${d.verificationCode}`], M + 32, H - 44);
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text("Assinatura por imagem inserida pelo responsável autenticado no portal (não constitui assinatura digital qualificada).", M + 32, H - 30);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(32, 92, 170);
    doc.text(`${siteConfig.letterheadName}, ${siteConfig.location.street}, TALATONA – LUANDA – ANGOLA${siteConfig.contacts.phone ? ` | M. ${siteConfig.contacts.phone}` : ""}`, M, H - 10);
    doc.setTextColor(150, 150, 150);
    doc.text(`${d.number} · Página ${p}/${pages}`, W - M, H - 5, { align: "right" });
  }
  return Buffer.from(doc.output("arraybuffer"));
}
