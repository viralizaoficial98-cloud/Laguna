"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Lock, LogIn, Mail, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { DemoBadge } from "@/components/ui/demo-badge";
import { Logo } from "@/components/site/logo";
import { Avatar } from "@/components/ui/avatar";
import { AuthError, login } from "@/services/auth.service";
import { useAuthStore } from "@/store/auth-store";
import { demoUsers, roleLabels, DEMO_PASSWORD } from "@/data/users";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.email("Indique um email válido."),
  password: z.string().min(6, "A palavra-passe deve ter pelo menos 6 caracteres."),
});
type FormData = z.infer<typeof schema>;

export function LoginView() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      const session = await login(data.email, data.password);
      setSession(session);
      toast.success(`Bem-vindo(a), ${session.name.split(" ")[0]}!`, { description: `Sessão iniciada como ${roleLabels[session.role]} (demonstração).` });
      router.push("/painel");
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Não foi possível iniciar sessão.");
    }
  };

  const fill = (email: string) => {
    setValue("email", email, { shouldValidate: true });
    setValue("password", DEMO_PASSWORD, { shouldValidate: true });
    setError(null);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Fotografia */}
      <div className="relative hidden overflow-hidden bg-navy-950 lg:block">
        <Image src="/images/laguna/lazer/piscina-vista-geral.webp" alt="Residencial Laguna" fill preload sizes="55vw" quality={85} className="animate-kenburns object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/50 to-navy-950/30" />
        <div className="absolute inset-0 flex flex-col justify-between p-12">
          <Logo variant="white" className="h-10" />
          <div>
            <p className="eyebrow mb-5 text-gold-300">Área de Moradores</p>
            <h1 className="max-w-lg font-display text-6xl leading-[1] text-white">
              A gestão do seu condomínio, <em className="text-gold-300">num só lugar</em>.
            </h1>
            <p className="mt-6 max-w-md text-navy-100/80">Quotas, pagamentos, circulares, comunicados e documentos — com toda a comodidade.</p>
          </div>
        </div>
      </div>

      {/* Formulário */}
      <div className="relative flex flex-col bg-white">
        <div className="flex items-center justify-between p-5 sm:p-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-graphite-500 transition hover:text-navy-900">
            <ArrowLeft className="h-4 w-4" /> Voltar ao portal
          </Link>
          <DemoBadge />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-10 sm:px-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-md">
            <Logo className="mb-10 h-11 lg:hidden" href={null} />
            <h2 className="font-display text-4xl text-navy-900">Entrar</h2>
            <p className="mt-2 text-sm text-graphite-500">Aceda à sua área reservada do Residencial Laguna.</p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
              <Field label="Email" error={errors.email?.message} htmlFor="email">
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-graphite-400" />
                  <Input id="email" type="email" autoComplete="username" placeholder="nome@residenciallaguna.ao" className="h-12 pl-10" invalid={!!errors.email} {...register("email")} />
                </div>
              </Field>
              <Field label="Palavra-passe" error={errors.password?.message} htmlFor="password">
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-graphite-400" />
                  <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" className="h-12 pr-11 pl-10" invalid={!!errors.password} {...register("password")} />
                  <button type="button" onClick={() => setShow((v) => !v)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-2 text-graphite-400 hover:bg-graphite-100 hover:text-navy-900" aria-label={show ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}>
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              {error && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                  {error}
                </motion.p>
              )}
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-graphite-600">
                  <input type="checkbox" className="h-4 w-4 accent-navy-900" defaultChecked /> Manter sessão
                </label>
                <button type="button" className="text-graphite-500 hover:text-navy-900" onClick={() => toast.info("Recuperação de palavra-passe disponível na fase de backend.")}>
                  Esqueceu-se da palavra-passe?
                </button>
              </div>
              <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
                {!isSubmitting && <LogIn className="h-4 w-4" />} Entrar
              </Button>
            </form>

            <div className="mt-10 rounded-2xl border border-gold-200/70 bg-gold-50/50 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold text-gold-900">
                <ShieldCheck className="h-4 w-4" /> Acesso de demonstração — clique para preencher
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {demoUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => fill(u.email)}
                    className={cn("flex items-center gap-3 rounded-xl border border-transparent bg-white px-3 py-2.5 text-left transition hover:border-gold-300 hover:shadow-soft")}
                  >
                    <Avatar name={u.name} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-navy-900">{u.name}</span>
                      <span className="block truncate text-[11px] text-graphite-500">{roleLabels[u.role]}</span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-gold-900/80">
                Palavra-passe de demonstração: <code className="rounded bg-white px-1.5 py-0.5 font-mono">{DEMO_PASSWORD}</code>. Os emails são apenas identificadores de acesso da demo — não utilizar em produção.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
