"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Send } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { DemoDataNote } from "@/components/ui/demo-badge";

const schema = z.object({
  name: z.string().min(3, "Indique o seu nome completo."),
  email: z.email("Indique um email válido."),
  phone: z.string().optional(),
  subject: z.string().min(1, "Seleccione o assunto."),
  message: z.string().min(10, "A mensagem deve ter pelo menos 10 caracteres."),
  consent: z.boolean().refine((v) => v, "É necessário aceitar o tratamento dos dados."),
});
type FormData = z.infer<typeof schema>;

export function ContactForm({ compact }: { compact?: boolean }) {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { consent: false, subject: "" } });

  const onSubmit = async () => {
    // Demonstração: nenhum dado é enviado. Futuro: POST /api/contactos
    await new Promise((r) => setTimeout(r, 800));
    setSent(true);
    reset();
    toast.success("Mensagem registada (modo demonstração)", { description: "Nenhum dado foi enviado para servidores." });
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-emerald-100 bg-emerald-50/60 px-6 py-14 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        <p className="mt-4 font-display text-3xl text-navy-900">Obrigado pelo contacto</p>
        <p className="mt-2 max-w-sm text-sm text-graphite-600">Este formulário é demonstrativo: a mensagem não foi enviada. Na versão final será encaminhada para a administração.</p>
        <Button variant="outline" className="mt-6" onClick={() => setSent(false)}>
          Enviar nova mensagem
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className={compact ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
        <Field label="Nome completo" required error={errors.name?.message} htmlFor="c-name">
          <Input id="c-name" autoComplete="name" invalid={!!errors.name} {...register("name")} />
        </Field>
        <Field label="Email" required error={errors.email?.message} htmlFor="c-email">
          <Input id="c-email" type="email" autoComplete="email" invalid={!!errors.email} {...register("email")} />
        </Field>
        <Field label="Telefone" htmlFor="c-phone">
          <Input id="c-phone" type="tel" autoComplete="tel" placeholder="+244" {...register("phone")} />
        </Field>
        <Field label="Assunto" required error={errors.subject?.message} htmlFor="c-subject">
          <Select id="c-subject" invalid={!!errors.subject} {...register("subject")}>
            <option value="">Seleccione…</option>
            <option>Informações sobre apartamentos</option>
            <option>Administração do condomínio</option>
            <option>Visitas ao condomínio</option>
            <option>Outro assunto</option>
          </Select>
        </Field>
      </div>
      <Field label="Mensagem" required error={errors.message?.message} htmlFor="c-msg">
        <Textarea id="c-msg" rows={5} invalid={!!errors.message} {...register("message")} />
      </Field>
      <label className="flex items-start gap-2.5 text-xs text-graphite-600">
        <input type="checkbox" className="mt-0.5 h-4 w-4 rounded accent-navy-900" {...register("consent")} />
        <span>
          Aceito o tratamento dos dados para resposta ao pedido.
          {errors.consent && <span className="block text-red-600">{errors.consent.message}</span>}
        </span>
      </label>
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <DemoDataNote>Formulário demonstrativo — sem envio real</DemoDataNote>
        <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
          <Send className="h-4 w-4" /> Enviar mensagem
        </Button>
      </div>
    </form>
  );
}
