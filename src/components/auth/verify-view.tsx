"use client";

import { CheckCircle2, ShieldX, XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthCard } from "./auth-card";

interface R {
  valid: boolean;
  number?: string;
  type?: string;
  status?: string;
  signedAt?: string | null;
  signer?: string | null;
  signerTitle?: string | null;
  fraction?: string | null;
  holder?: string;
  revokedAt?: string | null;
  sha256?: string | null;
}

/** Verificação pública da autenticidade de uma declaração (código QR) — sem expor dados pessoais completos. */
export function VerifyView() {
  const code = (useSearchParams().get("codigo") ?? "").toUpperCase();
  const [r, setR] = useState<R | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/verify?codigo=${encodeURIComponent(code)}`, { cache: "no-store" })
      .then((x) => x.json())
      .then((j) => alive && setR(j))
      .catch(() => alive && setR({ valid: false }));
    return () => {
      alive = false;
    };
  }, [code]);
  if (!r) return <AuthCard title="Verificar documento">A verificar…</AuthCard>;
  if (!r.valid)
    return (
      <AuthCard title="Documento não encontrado">
        <p className="flex items-start gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-800">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0" /> O código {code || "indicado"} não corresponde a nenhum documento emitido pelo condomínio.
        </p>
      </AuthCard>
    );
  const ok = r.status === "emitida";
  return (
    <AuthCard title={ok ? "Documento autêntico" : "Documento anulado"}>
      <p className={`mb-4 flex items-start gap-2 rounded-xl p-4 text-sm ${ok ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`} data-testid="verify-result">
        {ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <ShieldX className="mt-0.5 h-5 w-5 shrink-0" />}
        {ok ? "Este documento foi emitido pela Administração do Condomínio Laguna Residencial e encontra-se válido." : `Este documento foi anulado${r.revokedAt ? ` em ${r.revokedAt}` : ""} e não deve ser aceite.`}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-graphite-500">Documento</dt>
        <dd className="font-semibold text-navy-900">{r.number}</dd>
        <dt className="text-graphite-500">Tipo</dt>
        <dd>{r.type}</dd>
        <dt className="text-graphite-500">Fracção</dt>
        <dd>{r.fraction}</dd>
        <dt className="text-graphite-500">Titular</dt>
        <dd>{r.holder}</dd>
        <dt className="text-graphite-500">Emitido em</dt>
        <dd>{r.signedAt}</dd>
        <dt className="text-graphite-500">Assinado por</dt>
        <dd>
          {r.signer} — {r.signerTitle}
        </dd>
      </dl>
      {r.sha256 && <p className="mt-4 text-[10px] break-all text-graphite-400">SHA-256 do PDF: {r.sha256}</p>}
    </AuthCard>
  );
}
