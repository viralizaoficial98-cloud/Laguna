"use client";

import { Check, KeyRound } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { setPasswordWithToken, AuthError } from "@/services/auth.service";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { AuthCard } from "./auth-card";

type Info = { valid: boolean; type?: "activation" | "reset"; name?: string; email?: string; expiresAt?: string };

/** Definição da palavra-passe com ligação de activação ou de redefinição (utilização única). */
export function SetPasswordView({ mode }: { mode: "activation" | "reset" }) {
  const token = useSearchParams().get("token") ?? "";
  const [info, setInfo] = useState<Info | null>(null);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/auth/token?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: Info) => alive && setInfo(j))
      .catch(() => alive && setInfo({ valid: false }));
    return () => {
      alive = false;
    };
  }, [token]);

  const title = mode === "activation" ? "Activar conta" : "Definir nova palavra-passe";
  const rules = [
    { ok: pw.length >= 10, label: "Pelo menos 10 caracteres" },
    { ok: /[A-Za-zÀ-ÿ]/.test(pw) && /\d/.test(pw), label: "Letras e números" },
    { ok: pw.length > 0 && pw === confirm, label: "Confirmação igual" },
  ];

  if (!info) return <AuthCard title={title}>A verificar a ligação…</AuthCard>;
  if (!info.valid && !done)
    return (
      <AuthCard title={title}>
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Esta ligação é inválida, já foi utilizada ou expirou. Peça uma nova ligação à gestão do condomínio ou utilize “Esqueceu-se da palavra-passe?”.</p>
        <Link href="/recuperar" className={buttonClass("outline", "md", "mt-4")}>
          Pedir nova ligação
        </Link>
      </AuthCard>
    );
  if (done)
    return (
      <AuthCard title={mode === "activation" ? "Conta activada" : "Palavra-passe alterada"}>
        <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">A sua palavra-passe foi definida. Por segurança, as sessões anteriores foram terminadas.</p>
        <Link href="/login" className={buttonClass("primary", "md", "mt-4 w-full")}>
          Iniciar sessão
        </Link>
      </AuthCard>
    );

  return (
    <AuthCard
      title={title}
      description={
        <>
          {info.name} · {info.email}
          <br />
          Ligação de utilização única{info.expiresAt ? `, válida até ${new Date(info.expiresAt).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}` : ""}.
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (!rules.every((r) => r.ok)) return setError("A palavra-passe não cumpre os requisitos.");
          setBusy(true);
          try {
            await setPasswordWithToken(token, pw);
            setDone(true);
          } catch (err) {
            setError(err instanceof AuthError ? err.message : "Não foi possível definir a palavra-passe.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Nova palavra-passe" htmlFor="pw">
          <Input id="pw" name="password" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className="h-12" />
        </Field>
        <Field label="Confirmar palavra-passe" htmlFor="pw2">
          <Input id="pw2" name="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-12" />
        </Field>
        <ul className="space-y-1 text-xs">
          {rules.map((r) => (
            <li key={r.label} className={r.ok ? "text-emerald-700" : "text-graphite-500"}>
              <Check className="mr-1 inline h-3.5 w-3.5" />
              {r.label}
            </li>
          ))}
        </ul>
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          <KeyRound className="h-4 w-4" /> {mode === "activation" ? "Activar conta" : "Guardar palavra-passe"}
        </Button>
      </form>
    </AuthCard>
  );
}
