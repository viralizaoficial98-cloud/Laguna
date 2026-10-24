"use client";

import { Mail } from "lucide-react";
import { useState } from "react";
import { requestPasswordReset, AuthError } from "@/services/auth.service";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { AuthCard } from "./auth-card";

export function ForgotView() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <AuthCard title="Recuperar palavra-passe" description="Indique o email da sua conta. Por segurança, a resposta é sempre a mesma, exista ou não a conta.">
      {sent ? (
        <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
          {sent}
        </p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Indique um email válido.");
            setBusy(true);
            try {
              setSent((await requestPasswordReset(email)).message);
            } catch (err) {
              setError(err instanceof AuthError ? err.message : "Não foi possível enviar o pedido.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Email" htmlFor="email">
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-graphite-400" />
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 pl-10" />
            </div>
          </Field>
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Pedir ligação de redefinição
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
