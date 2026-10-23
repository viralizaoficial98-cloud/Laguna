"use client";

/**
 * Documentos financeiros em PDF A4 (jsPDF): recibo, extracto de conta corrente e
 * "Declaração de Regularização e Autorização Administrativa de Saída".
 * Não reproduz assinaturas nem carimbos — é reservado espaço para assinatura.
 */
import type { AccountSummary } from "@/lib/account";
import { siteConfig } from "@/config/site";
import { formatLongDatePT, todayISO } from "@/lib/utils";

type Doc = import("jspdf").jsPDF;
const NAVY: [number, number, number] = [11, 31, 58];
const M = 18;
const W = 210;
const H = 297;

const kz = (v: number) => `${new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 0 }).format(v).replace(/ | /g, " ")} Kz`;
const dt = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-PT");

async function logoData() {
  const blob = await (await fetch(siteConfig.logo.color)).blob();
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function newDoc(title: string, ref: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await logoData();
  const header = () => {
    doc.addImage(logo, "PNG", M, 12, 46, (46 * siteConfig.logo.height) / siteConfig.logo.width);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text("Administração", M, 30);
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 100);
    doc.text(ref, W - M, 16, { align: "right" });
    doc.text(`Emitido em ${new Date().toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}`, W - M, 21, { align: "right" });
    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.35);
    doc.line(M, 33, W - M, 33);
  };
  header();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  const lines: string[] = doc.splitTextToSize(title.toUpperCase(), W - 2 * M);
  lines.forEach((l, i) => doc.text(l, W / 2, 46 + i * 7, { align: "center" }));
  return { doc, y: 46 + lines.length * 7 + 6, header };
}

function footer(doc: Doc, note = "Documento gerado pelo Portal Residencial Laguna · dados de demonstração") {
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(32, 92, 170);
    doc.text(`${siteConfig.letterheadName}, ${siteConfig.location.street}, TALATONA – LUANDA – ANGOLA${siteConfig.contacts.phone ? ` | M. ${siteConfig.contacts.phone}` : ""}`, M, H - 10);
    doc.setTextColor(150, 150, 150);
    doc.text(`${note} · Página ${p}/${pages}`, W - M, H - 5, { align: "right" });
  }
}

function kv(doc: Doc, y: number, rows: [string, string][], col = 55) {
  doc.setFontSize(10);
  rows.forEach(([k, v], i) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(k, M, y + i * 6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(25, 25, 25);
    doc.text(v, M + col, y + i * 6.5);
  });
  return y + rows.length * 6.5 + 4;
}

function signature(doc: Doc, y: number, title: string, name: string) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(25, 25, 25);
  doc.text(`Luanda, aos ${formatLongDatePT(todayISO())}.`, M, y);
  const x = W / 2;
  doc.text(title, x + 30, y + 12, { align: "center" });
  doc.setDrawColor(180, 180, 180);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.roundedRect(x - 5, y + 15, 70, 24, 2, 2, "S");
  doc.setLineDashPattern([], 0);
  doc.setFontSize(7.5);
  doc.setTextColor(150, 150, 150);
  doc.text("Assinatura do responsável autorizado", x + 30, y + 28, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...NAVY);
  doc.text(name, x + 30, y + 46, { align: "center" });
}

export interface ReceiptData {
  receiptNumber: string;
  payer: string;
  apartment: string;
  typology?: string;
  description: string;
  period?: string;
  amount: number;
  method?: string;
  reference?: string;
  paidAt: string;
  validatedBy: string;
  /** Perfil de quem validou (ex.: "Gestor Operacional"). */
  validatedRole?: string;
  validatedAt: string;
}

/** Recibo emitido após confirmação do pagamento. */
export async function downloadReceipt(r: ReceiptData) {
  const { doc, y } = await newDoc("Recibo de pagamento", `Recibo N.º ${r.receiptNumber}`);
  let yy = kv(doc, y, [
    ["Recebemos de", r.payer],
    ["Fracção", `${r.apartment}${r.typology ? ` (${r.typology})` : ""}`],
    ["Referente a", r.description],
    ...(r.period ? ([["Período", r.period]] as [string, string][]) : []),
    ["Data do pagamento", dt(r.paidAt)],
    ["Método", r.method ?? "—"],
    ["Referência", r.reference || "Não indicada"],
    ["Validado por", `${r.validatedBy} · ${dt(r.validatedAt)}`],
  ]);
  doc.setFillColor(244, 245, 247);
  doc.roundedRect(M, yy, W - 2 * M, 16, 2, 2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text("Valor recebido", M + 4, yy + 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text(kz(r.amount), W - M - 4, yy + 10.5, { align: "right" });
  yy += 30;
  signature(doc, yy, r.validatedRole ?? "Gestor Financeiro", r.validatedBy);
  footer(doc);
  doc.save(`Recibo_${r.receiptNumber}.pdf`);
}

/** Extracto de conta corrente (fracção / processo). */
export async function downloadStatement(meta: { title?: string; ref: string; resident: string; apartment: string; typology: string; from?: string }, acc: AccountSummary) {
  const { doc, y, header } = await newDoc(meta.title ?? "Extracto de conta corrente", meta.ref);
  let yy = kv(doc, y, [
    ["Morador", meta.resident],
    ["Fracção", `${meta.apartment} (${meta.typology})`],
    ["Período de ocupação", meta.from ? `desde ${dt(meta.from)}` : "—"],
  ]);
  const summary: [string, number][] = [
    ["Quotas emitidas", acc.quotasTotal],
    ["Valores pagos", acc.paidTotal],
    ["Pagamentos em validação", acc.inValidation],
    ["Dívidas vencidas (quotas)", acc.overdue],
    ["Quotas vincendas", acc.upcoming],
    ["Encargos adicionais por liquidar", acc.charges],
    ["Reservas de salão por liquidar", acc.reservationsUnpaid],
    ["Créditos / pagamentos antecipados", acc.credits],
  ];
  doc.setFontSize(9.5);
  summary.forEach(([k, v], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * ((W - 2 * M) / 2);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(k, x, yy + row * 6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(25, 25, 25);
    doc.text(kz(v), x + (W - 2 * M) / 2 - 4, yy + row * 6, { align: "right" });
  });
  yy += Math.ceil(summary.length / 2) * 6 + 3;
  doc.setFillColor(acc.confirmedDebt > 0 ? 254 : 236, acc.confirmedDebt > 0 ? 242 : 253, acc.confirmedDebt > 0 ? 242 : 245);
  doc.roundedRect(M, yy, W - 2 * M, 12, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(acc.confirmedDebt > 0 || acc.inValidation > 0 ? "Saldo final em dívida / por validar" : "Saldo final — situação regularizada", M + 4, yy + 7.8);
  doc.text(kz(acc.confirmedDebt + acc.inValidation), W - M - 4, yy + 7.8, { align: "right" });
  yy += 19;

  if (acc.openItems.length) {
    doc.setFontSize(10);
    doc.text("VALORES EM ABERTO (por origem e período)", M, yy);
    yy += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    acc.openItems.forEach((o) => {
      doc.setTextColor(40, 40, 40);
      doc.text(`• ${o.origin}: ${o.description}`, M + 2, yy);
      doc.text(kz(o.amount), W - M, yy, { align: "right" });
      yy += 5.5;
    });
    yy += 3;
  }

  // movimentos
  const cols = [M, M + 24, M + 52, W - M - 84, W - M - 34, W - M];
  const row = (cells: string[], bold = false) => {
    if (yy > H - 22) {
      doc.addPage();
      header();
      yy = 44;
    }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);
    doc.text(cells[0], cols[0], yy);
    doc.text(cells[1], cols[1], yy);
    doc.text((doc.splitTextToSize(cells[2], cols[3] - cols[2] - 6)[0] as string) ?? "", cols[2], yy);
    doc.text(cells[3], cols[5] - 64, yy, { align: "right" });
    doc.text(cells[4], cols[5] - 34, yy, { align: "right" });
    doc.text(cells[5], cols[5], yy, { align: "right" });
    yy += 5;
  };
  doc.setFillColor(244, 245, 247);
  doc.rect(M, yy - 3.8, W - 2 * M, 5.5, "F");
  row(["Data", "Origem", "Descrição", "Débito", "Crédito", "Saldo"], true);
  acc.lines.forEach((l) => row([dt(l.date), l.origin, l.description, l.debit ? kz(l.debit) : "", l.credit ? kz(l.credit) : "", kz(l.balance)]));
  footer(doc);
  doc.save(`Extracto_${meta.ref.replace(/[^\w-]+/g, "_")}.pdf`);
}

/** Declaração de Regularização e Autorização Administrativa de Saída. */
export async function downloadClearance(m: {
  reference: string;
  residentName: string;
  block: string;
  number: string;
  typology: string;
  plannedDate: string;
  authorization: { by: string; role: string; at: string; notes?: string };
  financialBy?: string;
  operationalBy?: string;
}) {
  const { doc, y } = await newDoc("Declaração de Regularização e Autorização Administrativa de Saída", `Processo ${m.reference}`);
  let yy = kv(doc, y, [
    ["N.º do processo", m.reference],
    ["Morador", m.residentName],
    ["Bloco", m.block],
    ["Apartamento", `${m.number} (${m.typology})`],
    ["Data prevista de saída", dt(m.plannedDate)],
    ["Data da autorização", dt(m.authorization.at)],
    ["Situação financeira", `Regularizada${m.financialBy ? ` — verificada por ${m.financialBy}` : ""}`],
    ["Situação operacional", `Verificação concluída${m.operationalBy ? ` — por ${m.operationalBy}` : ""}`],
    ["Responsável pela validação", `${m.authorization.by} (${m.authorization.role})`],
  ], 62);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(25, 25, 25);
  const text = `Para os devidos efeitos, declara-se que, à data da presente, a fracção acima identificada não apresenta valores em dívida confirmados perante o ${siteConfig.letterheadName} no período de ocupação do morador, e que a verificação operacional foi concluída, pelo que se emite a autorização administrativa de saída.`;
  const lines: string[] = doc.splitTextToSize(text, W - 2 * M);
  lines.forEach((l, i) => doc.text(l, M, yy + i * 5.6));
  yy += lines.length * 5.6 + 4;
  if (m.authorization.notes) {
    const n: string[] = doc.splitTextToSize(`Observações: ${m.authorization.notes}`, W - 2 * M);
    n.forEach((l, i) => doc.text(l, M, yy + i * 5.6));
    yy += n.length * 5.6 + 4;
  }
  signature(doc, yy + 6, m.authorization.role, m.authorization.by);
  footer(doc, "Documento gerado pelo Portal Residencial Laguna");
  doc.save(`Declaracao_Saida_${m.reference}.pdf`);
}
