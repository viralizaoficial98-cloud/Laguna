import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { InfraIcon } from "@/components/site/infra-icon";
import { getInfrastructures } from "@/services/public.service";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Infraestruturas", description: "Piscinas, solário, zonas de estar e espaços verdes do Residencial Laguna." };

export default async function InfraestruturasPage() {
  const infras = await getInfrastructures();
  return (
    <>
      <PageHero
        image="/images/laguna/lazer/piscina-com-palmeira.webp"
        eyebrow="Infraestruturas"
        title="Espaços para viver melhor"
        description="Conheça as infraestruturas identificadas nas fotografias reais do Residencial Laguna."
        crumbs={[{ label: "Infraestruturas" }]}
      />
      <section className="py-24">
        <div className="container-site space-y-24">
          {infras.map((infra, i) => (
            <Reveal key={infra.slug} className={cn("grid items-center gap-10 lg:grid-cols-2 lg:gap-20")}>
              <div className={cn("group relative aspect-[4/3] overflow-hidden rounded-[2rem] shadow-lift", i % 2 === 1 && "lg:order-2")}>
                <Image src={infra.image} alt={infra.name} fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover transition-transform duration-[1.5s] group-hover:scale-105" />
                <span className="absolute top-5 left-5 font-display text-7xl text-white/90 drop-shadow-lg">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div>
                <div className="mb-6 flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-900 text-gold-300">
                    <InfraIcon name={infra.icon} className="h-5 w-5" />
                  </span>
                  {infra.confirmed ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-800">Identificado nas fotografias</span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-800">A confirmar pela administração</span>
                  )}
                </div>
                <h2 className="font-display text-4xl text-navy-900 sm:text-5xl">{infra.name}</h2>
                <div className="gold-rule my-6" />
                <p className="text-lg leading-relaxed text-graphite-600">{infra.summary}</p>
                <p className="mt-4 leading-relaxed text-graphite-500">{infra.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
