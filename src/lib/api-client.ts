"use client";

/** Utilitários de comunicação com o backend (apenas no browser). */

type InlineFile = { name: string; type?: string; size?: number; dataUrl?: string; fileId?: string };

function isInline(v: unknown): v is InlineFile & { dataUrl: string } {
  return !!v && typeof v === "object" && typeof (v as InlineFile).dataUrl === "string" && (v as InlineFile).dataUrl!.startsWith("data:") && typeof (v as InlineFile).name === "string";
}

async function upload(f: InlineFile & { dataUrl: string }): Promise<string> {
  const blob = await (await fetch(f.dataUrl)).blob();
  const form = new FormData();
  form.append("file", new File([blob], f.name, { type: f.type || blob.type }));
  const res = await fetch("/api/files", { method: "POST", body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Falha no envio do ficheiro.");
  return json.id as string;
}

/**
 * Envia para o servidor os ficheiros ainda em memória (data URL) presentes nos argumentos de uma acção
 * e substitui-os pela referência `fileId`. O conteúdo deixa de viajar dentro dos dados de negócio.
 */
export async function uploadInlineFiles<T>(value: T): Promise<T> {
  if (Array.isArray(value)) return (await Promise.all(value.map((v) => uploadInlineFiles(v)))) as T;
  if (isInline(value)) {
    const fileId = await upload(value);
    const { dataUrl: _omit, ...rest } = value;
    void _omit;
    return { ...rest, fileId } as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = await uploadInlineFiles(v);
    return out as T;
  }
  return value;
}

/** URL para pré-visualizar/descarregar um anexo (local ou guardado no servidor). */
export function fileSrc(f?: { dataUrl?: string; fileId?: string } | null) {
  if (!f) return undefined;
  return f.dataUrl ?? (f.fileId ? `/api/files/${f.fileId}` : undefined);
}
