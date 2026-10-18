"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useCurrentResident } from "@/hooks/use-session";
import { useAuthStore } from "@/store/auth-store";
import { useDemoStore } from "@/store/demo-store";
import { roleLabels } from "@/data/users";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const profileSchema = z.object({
  name: z.string().min(3, "Indique o nome."),
  email: z.email("Email inválido."),
  phone: z.string().optional(),
});
const pwSchema = z
  .object({
    current: z.string().min(1, "Indique a palavra-passe actual."),
    next: z.string().min(8, "Mínimo de 8 caracteres.").regex(/[A-Z]/, "Inclua uma maiúscula.").regex(/\d/, "Inclua um número."),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, { path: ["confirm"], message: "As palavras-passe não coincidem." });

export default function PerfilPage() {
  const { session, resident } = useCurrentResident();
  const setSession = useAuthStore((s) => s.setSession);
  const saveResident = useDemoStore((s) => s.saveResident);

  const profile = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: session?.name ?? "", email: session?.email ?? "", phone: resident?.phone ?? "" },
  });
  const pw = useForm<z.infer<typeof pwSchema>>({ resolver: zodResolver(pwSchema), defaultValues: { current: "", next: "", confirm: "" } });

  if (!session) return null;

  return (
    <>
      <PageHeader eyebrow="Conta" title="Meu perfil" description="Dados pessoais e segurança da conta." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="h-fit">
          <CardBody className="flex flex-col items-center text-center">
            <Avatar name={session.name} size="xl" />
            <p className="mt-4 font-display text-2xl text-navy-900">{session.name}</p>
            <p className="text-sm text-graphite-500">{session.title}</p>
            <Badge tone="gold" className="mt-3">{roleLabels[session.role]}</Badge>
            <p className="mt-4 text-xs text-graphite-400">Sessão iniciada em {formatDateTime(session.startedAt)}</p>
          </CardBody>
        </Card>
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Informações pessoais" />
            <CardBody>
              <form
                className="grid gap-4 sm:grid-cols-2"
                noValidate
                onSubmit={profile.handleSubmit((d) => {
                  setSession({ ...session, name: d.name, email: d.email });
                  if (resident) saveResident({ ...resident, name: d.name, email: d.email, phone: d.phone ?? resident.phone });
                  toast.success("Perfil actualizado (demonstração).");
                })}
              >
                <Field label="Nome" error={profile.formState.errors.name?.message} className="sm:col-span-2">
                  <Input {...profile.register("name")} />
                </Field>
                <Field label="Email" error={profile.formState.errors.email?.message}>
                  <Input type="email" {...profile.register("email")} />
                </Field>
                <Field label="Telefone">
                  <Input type="tel" {...profile.register("phone")} placeholder="+244" />
                </Field>
                <div className="flex justify-end sm:col-span-2">
                  <Button type="submit"><Save className="h-4 w-4" /> Guardar</Button>
                </div>
              </form>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Alterar palavra-passe" description="Simulação — as credenciais de teste não são alteradas." />
            <CardBody>
              <form
                className="grid gap-4 sm:grid-cols-3"
                noValidate
                onSubmit={pw.handleSubmit(() => {
                  pw.reset();
                  toast.success("Palavra-passe alterada (simulação).");
                })}
              >
                <Field label="Actual" error={pw.formState.errors.current?.message}>
                  <Input type="password" autoComplete="current-password" {...pw.register("current")} />
                </Field>
                <Field label="Nova" error={pw.formState.errors.next?.message}>
                  <Input type="password" autoComplete="new-password" {...pw.register("next")} />
                </Field>
                <Field label="Confirmar" error={pw.formState.errors.confirm?.message}>
                  <Input type="password" autoComplete="new-password" {...pw.register("confirm")} />
                </Field>
                <div className="flex justify-end sm:col-span-3">
                  <Button type="submit" variant="outline"><KeyRound className="h-4 w-4" /> Alterar palavra-passe</Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
