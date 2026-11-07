"use client";

/** Exportação para Excel (.xlsx) no browser (ExcelJS carregado apenas quando necessário). */
export async function downloadXlsx(filename: string, sheets: { name: string; head: string[]; rows: (string | number | null | undefined)[][]; money?: number[] }[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Portal Residencial Laguna";
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31));
    ws.addRow(s.head);
    ws.getRow(1).font = { bold: true };
    for (const r of s.rows) ws.addRow(r.map((v) => (v === undefined ? null : v)));
    s.money?.forEach((c) => (ws.getColumn(c + 1).numFmt = '#,##0.00 "Kz"'));
    ws.columns.forEach((col, i) => (col.width = Math.min(60, Math.max(10, ...[s.head[i] ?? "", ...s.rows.map((r) => String(r[i] ?? ""))].map((x) => x.length + 2)))));
  }
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
