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

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_LONG = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** "2026-10" → "Out 2026" */
export function formatPeriod(period: string, long = false) {
  const [y, m] = period.split("-").map(Number);
  return `${(long ? MONTHS_LONG : MONTHS)[m - 1]} ${y}`;
}

export function shortMonth(period: string) {
  return MONTHS[Number(period.split("-")[1]) - 1];
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
