"use client";

import { FileUp, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import type { PaymentProof } from "@/types";
import { formatBytes } from "@/lib/utils";

const MAX_SIZE = 5 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

/** Selecção local de um comprovativo/anexo (PDF ou imagem, máx. 5 MB). Não envia o ficheiro para nenhum servidor. */
export function ProofInput({ value, onChange, label = "Seleccionar comprovativo (PDF, JPG, PNG · máx. 5 MB)" }: { value: PaymentProof | null; onChange: (p: PaymentProof | null) => void; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const read = (file: File) => {
    if (!TYPES.includes(file.type)) return setError("Formato não suportado. Utilize PDF, JPG, PNG ou WEBP.");
    if (file.size > MAX_SIZE) return setError("O ficheiro excede 5 MB.");
    setError(null);
    const r = new FileReader();
    r.onload = () => onChange({ name: file.name, type: file.type, size: file.size, dataUrl: String(r.result) });
    r.readAsDataURL(file);
  };
  return (
    <div>
      <input ref={ref} type="file" accept={TYPES.join(",")} className="hidden" data-testid="proof-file" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
      {value ? (
        <div className="flex items-center justify-between rounded-xl bg-graphite-50 px-4 py-2.5 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <FileUp className="h-4 w-4 shrink-0 text-navy-600" />
            <span className="truncate">{value.name}</span>
            <span className="shrink-0 text-xs text-graphite-500">{formatBytes(value.size)}</span>
          </span>
          <button type="button" onClick={() => onChange(null)} className="rounded-lg p-1.5 text-graphite-400 hover:bg-red-50 hover:text-red-600" aria-label="Remover ficheiro">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} className="flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-graphite-200 px-4 py-6 text-center text-sm hover:border-navy-300 hover:bg-navy-50/40">
          <UploadCloud className="h-7 w-7 text-navy-500" />
          <span className="mt-2 text-graphite-600">{label}</span>
        </button>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
