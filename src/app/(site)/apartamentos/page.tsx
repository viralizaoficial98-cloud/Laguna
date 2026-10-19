import type { Metadata } from "next";
import { Info } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { ApartmentsExplorer } from "@/components/site/apartments-explorer";
import { getTypologies } from "@/services/public.service";

export const metadata: Metadata = { title: "Apartamentos", description: "Tipologias de apartamentos do Residencial Laguna." };

export default async function ApartamentosPage() {
  const typologies = await getTypologies();
  return (
    <>
      <PageHero image="/images/laguna/fachadas/edificio-residencial.webp" eyebrow="Apartamentos" title="Encontre o seu apartamento" description="Conheça as tipologias disponíveis no Residencial Laguna." crumbs={[{ label: "Apartamentos" }]} />
      <section className="bg-graphite-50 py-20">
        <div className="container-site">
          <div className="mb-8 flex items-start gap-3 rounded-2xl border border-navy-100 bg-navy-50/70 px-5 py-4 text-sm text-navy-900">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-navy-600" />
            <p>
              O Residencial Laguna dispõe de apartamentos T2, T3 e T4. Áreas, número de casas de banho, preços e disponibilidade serão
              publicados após confirmação pela Administração.
            </p>
          </div>
          <ApartmentsExplorer typologies={typologies} />
        </div>
      </section>
    </>
  );
}
