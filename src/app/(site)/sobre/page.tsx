import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { buttonClass } from "@/components/ui/button";
import { siteStats } from "@/config/site";

export const metadata: Metadata = { title: "Sobre", description: "Conheça o Residencial Laguna, condomínio residencial em Talatona, Luanda." };

const characteristics = [
  "Edifícios residenciais de vários pisos organizados em torno de um espaço central",
  "Piscina principal com ilha ajardinada e palmeira",
  "Piscina infantil independente",
  "Solário com espreguiçadeiras e zonas de estar com guarda-sóis",
  "Palmeiras, vasos ornamentais e pérgola em madeira",
  "Entrada principal com portão e sinalética do condomínio",
];

const values = [
  { title: "Conforto", text: "Espaços comuns cuidados e pensados para o descanso e o convívio." },
  { title: "Segurança", text: "Acesso organizado através da entrada principal do condomínio." },
  { title: "Organização", text: "Uma gestão transparente, com comunicação digital entre a administração e os moradores." },
  { title: "Comunidade", text: "Um ambiente residencial que valoriza a boa convivência entre vizinhos." },
];

export default function SobrePage() {
  return (
    <>
      <PageHero
        image="/images/laguna/lazer/piscina-vista-geral.webp"
        eyebrow="Sobre nós"
        title="Residencial Laguna"
        description="Um condomínio residencial em Talatona, Luanda, onde a tranquilidade e a modernidade se encontram."
        crumbs={[{ label: "Sobre" }]}
      />

      <section className="py-24">
        <div className="container-site grid gap-16 lg:grid-cols-2">
          <div>
            <SectionHeading
              className="mb-8"
              eyebrow="Apresentação"
              title={
                <>
                  Viver em Talatona, <em className="text-gold-600">com qualidade</em>
                </>
              }
            />
            <div className="space-y-5 text-base leading-relaxed text-graphite-600">
              <p>
                O Residencial Laguna é um condomínio residencial localizado em Talatona, na zona de Luanda Sul. Os edifícios residenciais
                desenvolvem-se em torno de um espaço central de lazer, onde as piscinas, as palmeiras e as zonas de estar criam um ambiente
                acolhedor e descontraído.
              </p>
              <p>
                O projecto valoriza o conforto, a segurança e a organização, oferecendo aos moradores um lugar onde é possível desfrutar da
                vida em família e da convivência com os vizinhos, sem sair de casa.
              </p>
              <p className="rounded-2xl border border-gold-200 bg-gold-50/60 p-4 text-sm text-gold-900">
                Nota: o texto institucional definitivo, a história do empreendimento e os dados técnicos (número de blocos, apartamentos, áreas)
                serão incluídos após validação pela administração do condomínio.
              </p>
            </div>
          </div>
          <Reveal className="grid grid-cols-2 gap-4">
            <div className="relative col-span-2 aspect-[16/10] overflow-hidden rounded-3xl shadow-lift">
              <Image src="/images/laguna/lazer/piscina-e-deck.webp" alt="Deck da piscina do Residencial Laguna" fill sizes="(min-width:1024px) 45vw, 100vw" className="object-cover" />
            </div>
            <div className="relative aspect-square overflow-hidden rounded-3xl shadow-soft">
              <Image src="/images/laguna/fachadas/edificio-residencial.webp" alt="Edifício residencial" fill sizes="25vw" className="object-cover" />
            </div>
            <div className="relative aspect-square overflow-hidden rounded-3xl shadow-soft">
              <Image src="/images/laguna/areas-exteriores/pergola-e-jardim.webp" alt="Pérgola e jardim" fill sizes="25vw" className="object-cover" />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-graphite-50 py-24">
        <div className="container-site grid gap-16 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <SectionHeading className="mb-6" eyebrow="Características" title="O que distingue o condomínio" description="Características confirmadas a partir das fotografias reais." />
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:col-span-3">
            {characteristics.map((c, i) => (
              <Reveal key={c} delay={i * 0.05} className="flex gap-3 rounded-2xl border border-graphite-100 bg-white p-5 shadow-soft">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-700">
                  <Check className="h-4 w-4" />
                </span>
                <span className="text-sm text-graphite-700">{c}</span>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-24">
        <div className="container-site">
          <SectionHeading align="center" eyebrow="Valores" title="Um condomínio com propósito" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v, i) => (
              <Reveal key={v.title} delay={i * 0.08} className="group rounded-3xl border border-graphite-100 p-8 transition-all duration-500 hover:-translate-y-1 hover:border-navy-900 hover:bg-navy-900 hover:shadow-lift">
                <p className="font-display text-5xl text-gold-500">0{i + 1}</p>
                <p className="mt-6 font-display text-2xl text-navy-900 transition-colors group-hover:text-white">{v.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-graphite-500 transition-colors group-hover:text-navy-100">{v.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-navy-950 py-20">
        <div className="container-site">
          <div className="grid gap-px overflow-hidden rounded-3xl bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {siteStats.map((s) => (
              <div key={s.label} className="bg-navy-950 p-8">
                <p className="text-[11px] font-semibold tracking-[0.22em] text-gold-400 uppercase">{s.label}</p>
                <p className={`mt-3 font-display ${s.value ? "text-5xl text-white" : "text-2xl text-white/60 italic"}`}>{s.value ?? "Por confirmar"}</p>
                <p className="mt-2 text-xs text-navy-200/70">{s.hint}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            <Link href="/infraestruturas" className={buttonClass("gold", "lg", "group")}>
              Ver infraestruturas <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/galeria" className={buttonClass("outline", "lg", "border-white/25 bg-transparent text-white hover:bg-white/10")}>
              Galeria de fotografias
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
