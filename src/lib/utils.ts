import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const kzFormatter = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  maximumFractionDigits: 0,
});

/** Formata valores em Kwanza (ex.: 45 000 Kz). */
export function formatKz(value: number) {
  return kzFormatter.format(value).replace("AOA", "Kz");
}

/** Versão compacta para eixos de gráficos (ex.: 1,2 M Kz). */
export function formatKzCompact(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toLocaleString("pt-AO", { maximumFractionDigits: 1 })} M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toLocaleString("pt-AO", { maximumFractionDigits: 0 })} mil`;
  return value.toLocaleString("pt-AO");
}

export function formatDate(value: string | Date, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }) {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("pt-PT", opts);
}

export function formatDateTime(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatTime(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

const MONTHS_LONG = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const QUARTER_MONTHS = ["Janeiro a Março", "Abril a Junho", "Julho a Setembro", "Outubro a Dezembro"];

/** "2026-T4" → { year: 2026, quarter: 4 } */
export function parseQuarter(period: string) {
  const [y, q] = period.split("-T");
  return { year: Number(y), quarter: Number(q) as 1 | 2 | 3 | 4 };
}

export function quarterKey(year: number, quarter: number) {
  return `${year}-T${quarter}`;
}

/** "2026-T4" → "4.º Trimestre 2026" (long) ou "T4 2026" (curto) */
export function formatQuarter(period: string, style: "long" | "short" | "months" = "long") {
  const { year, quarter } = parseQuarter(period);
  if (style === "short") return `T${quarter} ${year}`;
  if (style === "months") return `${QUARTER_MONTHS[quarter - 1]} ${year}`;
  return `${quarter}.º Trimestre ${year}`;
}

export function quarterMonths(period: string) {
  return QUARTER_MONTHS[parseQuarter(period).quarter - 1];
}

/** Trimestre de uma data ISO. */
export function quarterOf(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  return quarterKey(d.getFullYear(), Math.floor(d.getMonth() / 3) + 1);
}

export function nextQuarter(period: string) {
  const { year, quarter } = parseQuarter(period);
  return quarter === 4 ? quarterKey(year + 1, 1) : quarterKey(year, quarter + 1);
}

/** Data ISO (YYYY-MM-DD) de hoje, no fuso local. */
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "16 de Outubro de 2025" — formato usado nas circulares oficiais. */
export function formatLongDatePT(value: string) {
  const d = new Date(value + (value.length === 10 ? "T12:00:00" : ""));
  return `${d.getDate()} de ${MONTHS_LONG[d.getMonth()]} de ${d.getFullYear()}`;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function includesText(haystack: (string | undefined | null)[], needle: string) {
  if (!needle.trim()) return true;
  const n = slugify(needle).replace(/-/g, " ");
  return haystack.some((h) => h && slugify(h).replace(/-/g, " ").includes(n));
}

/** Gera e descarrega um ficheiro CSV no browser (separador ";" para Excel PT). */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  downloadBlob(filename, new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Gerador pseudo-aleatório determinístico para dados de demonstração estáveis. */
export function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
