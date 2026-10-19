"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Download, Eye, Save, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type { Circular, CircularRecipients } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { siteConfig } from "@/config/site";
import { todayISO, uid } from "@/lib/utils";
import { circularNumber, nextCircularSequence, recipientSummary } from "@/lib/circular";
import { downloadCircularPdf } from "@/lib/circular-pdf";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { CircularDocument } from "@/components/app/widgets/circular-document";
import { RecipientsPicker } from "@/components/app/widgets/recipients-picker";

const schema = z.object({
  sequence: z.coerce.number<number>().int().min(1, "Número inválido."),
  date: z.string().min(1, "Indique a data."),
  subject: z.string().trim().min(5, "O assunto deve ter pelo menos 5 caracteres."),
  body: z.string().trim().min(20, "O texto deve ter pelo menos 20 caracteres."),
  closing: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function CircularEditorPage() {
  const params = useSearchParams();
  const router = useRouter();
  const circulars = useDemoStore((s) => s.circulars);
  const saveCircular = useDemoStore((s) => s.saveCircular);
  const existing = circulars.find((c) => c.id === params.get("id"));
  const [view, setView] = useState<"editar" | "preview">("editar");
  const [recipients, setRecipients] = useState<CircularRecipients>(existing?.recipients ?? { mode: "todos", blocks: {}, listInBody: true });

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: existing
      ? { sequence: existing.sequence, date: existing.date, subject: existing.subject, body: existing.body, closing: existing.closing ?? "" }
      : {
          sequence: nextCircularSequence(circulars, Number(todayISO().slice(0, 4))),
          date: todayISO(),
          subject: "",
          body: "",
          closing: "",
        },
  });
  const values = useWatch({ control });
  const year = Number((values.date || todayISO()).slice(0, 4));
  const number = circularNumber(Number(values.sequence) || 1, year);

  const build = (d: FormData, status: Circular["status"]): Circular | null => {
    const y = Number(d.date.slice(0, 4));
    if (circulars.some((c) => c.id !== existing?.id && c.year === y && c.sequence === d.sequence)) {
      setError("sequence", { message: `Já existe a circular ${circularNumber(d.sequence, y)}. Próximo livre: ${String(nextCircularSequence(circulars.filter((c) => c.id !== existing?.id), y)).padStart(2, "0")}.` });
      return null;
    }
    if (recipients.mode === "seleccao" && Object.keys(recipients.blocks).length === 0) {
      toast.error("Seleccione pelo menos um bloco destinatário.");
      return null;
    }
    return {
      id: existing?.id ?? uid("cir"),
      sequence: d.sequence,
      year: y,
      number: circularNumber(d.sequence, y),
      subject: d.subject.trim(),
      body: d.body.trim(),
      closing: d.closing?.trim() || undefined,
      date: d.date,
      recipients,
      status,
      author: siteConfig.administrator.name,
      authorTitle: siteConfig.administrator.title,
      publishedAt: status === "publicada" ? existing?.publishedAt ?? new Date().toISOString() : existing?.publishedAt,
      updatedAt: new Date().toISOString(),
    };
  };

  const save = (status: Circular["status"]) =>
    handleSubmit((d) => {
      const c = build(d, status);
      if (!c) return;
      try {
        saveCircular(c);
        toast.success(status === "publicada" ? `Circular ${c.number} publicada para os moradores (demonstração)` : `Rascunho ${c.number} guardado`);
        router.push(`/painel/circulares/ver?id=${c.id}`);
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();

  const pdf = () =>
    handleSubmit(async (d) => {
      const c = build(d, existing?.status === "publicada" ? "publicada" : "rascunho");
      if (c) await downloadCircularPdf(c);
    })();

  const preview = (
    <div className="overflow-x-auto rounded-2xl bg-graphite-100 p-3 sm:p-6">
      <CircularDocument
        circular={{
          number,
          date: values.date ?? "",
          subject: values.subject ?? "",
          body: values.body ?? "",
          closing: values.closing ?? "",
          author: siteConfig.administrator.name,
          recipients,
          status: existing?.status === "publicada" ? "publicada" : "rascunho",
        }}
      />
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow="Circulares"
        title={existing ? `Editar circular ${existing.number}` : "Emitir circular"}
        description={`Modelo oficial da Administração · emitida por ${siteConfig.administrator.name}, ${siteConfig.administrator.title}.`}
        actions={
          <>
            <Link href="/painel/circulares" className={buttonClass("ghost")}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
            <Button variant="outline" onClick={pdf}>
              <Download className="h-4 w-4" /> PDF
            </Button>
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
              <Field label="N.º sequencial do ano" required error={errors.sequence?.message} hint={`Referência: CIRCULAR N.º ${number}`}>
                <Input type="number" min={1} {...register("sequence")} invalid={!!errors.sequence} />
              </Field>
              <Field label="Data" required error={errors.date?.message}>
                <Input type="date" {...register("date")} />
              </Field>
              <Field label="Assunto" required error={errors.subject?.message} className="sm:col-span-2">
                <Input {...register("subject")} invalid={!!errors.subject} placeholder="Ex.: Cortes de Água, Luz e Gás aos Condóminos Devedores" />
              </Field>
              <Field label="Texto da comunicação" required error={errors.body?.message} hint="Separe os parágrafos com uma linha em branco." className="sm:col-span-2">
                <Textarea rows={9} {...register("body")} invalid={!!errors.body} className="leading-relaxed" />
              </Field>
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-xs font-medium text-graphite-700">Destinatários</p>
                <RecipientsPicker value={recipients} onChange={setRecipients} />
                <p className="mt-1.5 text-xs text-graphite-500">{recipientSummary(recipients)}</p>
              </div>
              <Field label="Texto final (opcional)" hint="Aparece depois da lista de blocos e apartamentos." className="sm:col-span-2">
                <Textarea rows={3} {...register("closing")} />
              </Field>
              <div className="rounded-xl bg-graphite-50 p-3 text-xs text-graphite-600 sm:col-span-2">
                Assinatura: <strong>{siteConfig.administrator.signatureTitle} — {siteConfig.administrator.name}</strong>. É reservado espaço para assinatura e carimbo;
                a assinatura digital só será aplicada quando estiver configurada e autorizada.
              </div>
            </form>
          </CardBody>
        </Card>
        <div className={view === "editar" ? "hidden xl:block" : ""}>
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-graphite-500">
            <Eye className="h-3.5 w-3.5" /> Pré-visualização (A4)
          </p>
          {preview}
        </div>
      </div>
    </>
  );
}
