"use client";

/**
 * Relatórios executivos e operacionais em PDF (A4), gerados no browser com jsPDF.
 * Estrutura: identificação do condomínio, período, indicadores, gráficos, resumo,
 * pendências, recomendações, tabelas e data de emissão.
 */
import { siteConfig } from "@/config/site";
import { formatKzCompact } from "@/lib/utils";

export interface ReportChart {
  title: string;
  categories: string[];
  series: { label: string; values: number[] }[];
  /** formatação dos valores no eixo */
  unit?: "kz" | "pct" | "n";
}

export interface ReportSpec {
  title: string;
  subtitle: string;
  period: string;
  author: string;
  kpis: { label: string; value: string }[];
  charts: ReportChart[];
  summary: string[];
  pending: string[];
  recommendations: string[];
  tables?: { title: string; head: string[]; rows: (string | number)[][] }[];
  fileName: string;
}

const PALETTE: [number, number, number][] = [
  [46, 90, 156],
  [184, 135, 58],
  [14, 156, 142],
  [154, 91, 192],
];
const NAVY: [number, number, number] = [11, 31, 58];

async function loadImage(src: string) {
  const blob = await (await fetch(src)).blob();
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function fmt(v: number, unit: ReportChart["unit"]) {
  if (unit === "pct") return `${Math.round(v)}%`;
  if (unit === "kz") return formatKzCompact(v);
  return String(Math.round(v));
}

export async function buildReportPdf(spec: ReportSpec) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const M = 16;
  const CW = W - M * 2;
  let y = 0;
  const logo = await loadImage(siteConfig.logo.color);
  const emitted = new Date();
  const emittedStr = `${emitted.toLocaleDateString("pt-PT")} ${emitted.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`;

  const header = (first: boolean) => {
    doc.addImage(logo, "PNG", M, 10, 40, (40 * siteConfig.logo.height) / siteConfig.logo.width);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text("Administração", M, 25.5);
    doc.text(`${siteConfig.letterheadName} · ${siteConfig.location.street}, Talatona – Luanda`, W - M, 14, { align: "right" });
    doc.text(`Período: ${spec.period}`, W - M, 19, { align: "right" });
    doc.text(`Emitido em ${emittedStr}`, W - M, 24, { align: "right" });
    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.3);
    doc.line(M, 28, W - M, 28);
    y = 36;
    if (first) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(...NAVY);
      doc.text(spec.title, M, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(90, 90, 90);
      doc.text(spec.subtitle, M, y);
      y += 8;
    }
  };

  const ensure = (h: number) => {
    if (y + h > H - 18) {
      doc.addPage();
      header(false);
    }
  };

  const section = (title: string) => {
    ensure(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(title.toUpperCase(), M, y);
    doc.setDrawColor(196, 154, 74);
    doc.setLineWidth(0.6);
    doc.line(M, y + 1.5, M + 18, y + 1.5);
    y += 7;
  };

  const lines = (items: string[], bullet = "•") => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(35, 35, 35);
    items.forEach((t) => {
      const wrapped: string[] = doc.splitTextToSize(t, CW - 6);
      ensure(wrapped.length * 4.6 + 1);
      doc.text(bullet, M + 1, y);
      wrapped.forEach((l, i) => doc.text(l, M + 6, y + i * 4.6));
      y += wrapped.length * 4.6 + 1.2;
    });
    y += 2;
  };

  header(true);

  // Indicadores
  section("Indicadores principais");
  const cols = 3;
  const bw = (CW - (cols - 1) * 3) / cols;
  spec.kpis.forEach((k, i) => {
    const col = i % cols;
    if (col === 0) ensure(17);
    const x = M + col * (bw + 3);
    doc.setFillColor(244, 245, 247);
    doc.roundedRect(x, y, bw, 15, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(103, 112, 131);
    doc.text(k.label, x + 3, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...NAVY);
    doc.text(k.value, x + 3, y + 11.5);
    if (col === cols - 1 || i === spec.kpis.length - 1) y += 18;
  });
  y += 2;

  // Gráficos (barras agrupadas desenhadas)
  if (spec.charts.length) section("Gráficos");
  spec.charts.forEach((c) => {
    const ch = 52;
    ensure(ch + 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...NAVY);
    doc.text(c.title, M, y);
    // legenda
    let lx = W - M;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    [...c.series].reverse().forEach((s, ri) => {
      const idx = c.series.length - 1 - ri;
      const tw = doc.getTextWidth(s.label);
      lx -= tw;
      doc.setTextColor(80, 80, 80);
      doc.text(s.label, lx, y);
      lx -= 4;
      doc.setFillColor(...PALETTE[idx % PALETTE.length]);
      doc.rect(lx, y - 2.4, 2.6, 2.6, "F");
      lx -= 5;
    });
    y += 4;
    const top = y;
    const left = M + 14;
    const plotW = CW - 14;
    const max = Math.max(1, ...c.series.flatMap((s) => s.values));
    const niceMax = c.unit === "pct" ? 100 : max * 1.1;
    doc.setDrawColor(225, 228, 233);
    doc.setLineWidth(0.2);
    for (let g = 0; g <= 4; g++) {
      const gy = top + ch - (ch * g) / 4;
      doc.line(left, gy, left + plotW, gy);
      doc.setFontSize(6.5);
      doc.setTextColor(120, 120, 120);
      doc.text(fmt((niceMax * g) / 4, c.unit), left - 2, gy + 1, { align: "right" });
    }
    const groupW = plotW / Math.max(1, c.categories.length);
    const barW = Math.min(9, (groupW * 0.7) / c.series.length);
    c.categories.forEach((cat, ci) => {
      const gx = left + ci * groupW + (groupW - barW * c.series.length) / 2;
      c.series.forEach((s, si) => {
        const v = s.values[ci] ?? 0;
        const h = (v / niceMax) * ch;
        doc.setFillColor(...PALETTE[si % PALETTE.length]);
        if (h > 0) doc.rect(gx + si * barW, top + ch - h, barW - 0.6, h, "F");
      });
      doc.setFontSize(6.8);
      doc.setTextColor(90, 90, 90);
      doc.text(cat, left + ci * groupW + groupW / 2, top + ch + 4, { align: "center" });
    });
    y = top + ch + 11;
  });

  section("Resumo executivo");
  lines(spec.summary, "–");
  section("Pendências");
  lines(spec.pending.length ? spec.pending : ["Sem pendências relevantes no período."]);
  section("Recomendações");
  lines(spec.recommendations.length ? spec.recommendations : ["Manter o acompanhamento regular dos indicadores."], "→");

  // Tabelas
  (spec.tables ?? []).forEach((t) => {
    section(t.title);
    const colW = CW / t.head.length;
    const row = (cells: (string | number)[], bold = false) => {
      ensure(6);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(7.8);
      doc.setTextColor(bold ? 11 : 40, bold ? 31 : 40, bold ? 58 : 40);
      cells.forEach((cell, i) => {
        const txt = doc.splitTextToSize(String(cell), colW - 2)[0] as string;
        doc.text(txt, M + i * colW + 1, y);
      });
      y += 5;
    };
    doc.setFillColor(244, 245, 247);
    doc.rect(M, y - 3.6, CW, 5.2, "F");
    row(t.head, true);
    t.rows.forEach((r) => row(r));
    y += 3;
  });

  // Rodapé com numeração
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(32, 92, 170);
    doc.text(`${siteConfig.name} · ${spec.title} · ${spec.author}`, M, H - 9);
    doc.setTextColor(150, 150, 150);
    doc.text(`Dados de demonstração · Página ${p}/${pages}`, W - M, H - 9, { align: "right" });
  }

  doc.setProperties({ title: spec.title, subject: spec.period, author: spec.author, creator: "Portal Residencial Laguna" });
  return doc;
}

export async function downloadReportPdf(spec: ReportSpec) {
  const doc = await buildReportPdf(spec);
  doc.save(spec.fileName);
}

export async function reportPdfUrl(spec: ReportSpec) {
  const doc = await buildReportPdf(spec);
  return URL.createObjectURL(doc.output("blob"));
}
