import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { NoticeCard } from "@/components/site/notice-card";
import { Reveal } from "@/components/site/reveal";
import { getPublicNotices } from "@/services/public.service";

export const metadata: Metadata = { title: "Comunicados", description: "Comunicados públicos do Residencial Laguna." };

export default async function ComunicadosPage() {
  const notices = await getPublicNotices();
  return (
    <>
      <PageHero image="/images/laguna/fachadas/entrada-principal.webp" eyebrow="Comunicados" title="Comunicados públicos" description="Informações e avisos da administração do condomínio." crumbs={[{ label: "Comunicados" }]} />
      <section className="py-20">
        <div className="container-site">
          <div className="mb-10 flex items-center gap-3 rounded-2xl border border-gold-200 bg-gold-50/70 px-5 py-4 text-sm text-gold-900">
            <FlaskConical className="h-5 w-5 shrink-0" />
            Os comunicados apresentados são conteúdo de teste, criado para demonstração do portal.
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {notices.map((n, i) => (
              <Reveal key={n.slug} delay={i * 0.06}>
                <NoticeCard notice={n} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
