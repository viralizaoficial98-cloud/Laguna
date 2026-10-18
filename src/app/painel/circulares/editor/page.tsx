"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Eye, Save, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type { Circular } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { useSession } from "@/hooks/use-session";
import { DEMO_TODAY } from "@/data/management";
import { uid } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { CircularDocument } from "@/components/app/widgets/circular-document";

const schema = z.object({
  number: z.string().regex(/^\d{3}\/\d{4}$/, "Formato: 000/2026"),
  date: z.string().min(1, "Indique a data."),
  subject: z.string().min(5, "O assunto deve ter pelo menos 5 caracteres."),
  audience: z.string().min(1),
  body: z.string().min(20, "O corpo deve ter pelo menos 20 caracteres."),
  author: z.string().min(3),
  authorTitle: z.string().min(3),
});
type FormData = z.infer<typeof schema>;

export default function CircularEditorPage() {
  const params = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const circulars = useDemoStore((s) => s.circulars);
  const saveCircular = useDemoStore((s) => s.saveCircular);
  const existing = circulars.find((c) => c.id === params.get("id"));
  const [view, setView] = useState<"editar" | "preview">("editar");

  const nextNumber = () => {
    const max = Math.max(0, ...circulars.filter((c) => c.number.endsWith("/2026")).map((c) => Number(c.number.split("/")[0])));
    return `${String(max + 1).padStart(3, "0")}/2026`;
  };

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: existing ?? {
      number: nextNumber(),
      date: DEMO_TODAY,
      subject: "",
      audience: "Todos os moradores",
      body: "Exmos. Senhores Moradores,\n\n\n\nCom os melhores cumprimentos,",
      author: session?.name ?? "",
      authorTitle: session?.title ?? "",
    },
  });
  const values = useWatch({ control });

  const save = (status: Circular["status"]) =>
    handleSubmit((d) => {
      const c: Circular = {
        ...d,
        id: existing?.id ?? uid("cir"),
        status,
        publishedAt: status === "publicada" ? new Date().toISOString() : existing?.publishedAt,
        updatedAt: new Date().toISOString(),
      };
      saveCircular(c);
      toast.success(status === "publicada" ? `Circular ${c.number} publicada (demonstração)` : "Rascunho guardado");
      router.push(`/painel/circulares/ver?id=${c.id}`);
    })();

  const preview = (
    <div className="overflow-x-auto rounded-2xl bg-graphite-100 p-3 sm:p-6">
      <div className="origin-top">
        <CircularDocument
          circular={{
            number: values.number ?? "",
            date: values.date ?? "",
            subject: values.subject ?? "",
            body: values.body ?? "",
            author: values.author ?? "",
            authorTitle: values.authorTitle ?? "",
            audience: values.audience ?? "",
            status: existing?.status === "publicada" ? "publicada" : "rascunho",
          }}
        />
      </div>
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow="Circulares"
        title={existing ? `Editar circular ${existing.number}` : "Nova circular"}
        description="A pré-visualização actualiza-se à medida que escreve."
        actions={
          <>
            <Link href="/painel/circulares" className={buttonClass("ghost")}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
            <Button variant="outline" onClick={() => save("rascunho")}>
              <Save className="h-4 w-4" /> Guardar rascunho
            </Button>
            <Button onClick={() => save("publicada")}>
              <Send className="h-4 w-4" /> Publicar
            </Button>
          </>
        }
      />
      <Tabs className="mb-4 xl:hidden" value={view} onChange={setView} tabs={[{ id: "editar", label: "Editar" }, { id: "preview", label: "Pré-visualizar" }]} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Card className={view === "preview" ? "hidden xl:block" : ""}>
          <CardBody>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()} noValidate>
              <Field label="Numeração" required error={errors.number?.message}>
                <Input {...register("number")} invalid={!!errors.number} />
              </Field>
              <Field label="Data" required error={errors.date?.message}>
                <Input type="date" {...register("date")} />
              </Field>
              <Field label="Assunto" required error={errors.subject?.message} className="sm:col-span-2">
                <Input {...register("subject")} invalid={!!errors.subject} placeholder="Ex.: Manutenção das áreas comuns" />
              </Field>
              <Field label="Destinatários" className="sm:col-span-2">
                <Select {...register("audience")}>
                  <option>Todos os moradores</option>
                  <option>Proprietários</option>
                  <option>Moradores do Bloco A</option>
                  <option>Moradores do Bloco B</option>
                  <option>Moradores do Bloco C</option>
                </Select>
              </Field>
              <Field label="Corpo do documento" required error={errors.body?.message} className="sm:col-span-2">
                <Textarea rows={14} {...register("body")} invalid={!!errors.body} className="font-[450] leading-relaxed" />
              </Field>
              <Field label="Responsável" required error={errors.author?.message}>
                <Input {...register("author")} />
              </Field>
              <Field label="Cargo" required error={errors.authorTitle?.message}>
                <Input {...register("authorTitle")} />
              </Field>
            </form>
          </CardBody>
        </Card>
        <div className={view === "editar" ? "hidden xl:block" : ""}>
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-graphite-500">
            <Eye className="h-3.5 w-3.5" /> Pré-visualização
          </p>
          {preview}
        </div>
      </div>
    </>
  );
}
