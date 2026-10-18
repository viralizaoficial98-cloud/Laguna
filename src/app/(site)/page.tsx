import { ArrowRight, CalendarCheck2, MapPin, ShieldCheck, Sparkles, Trees, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { HeroSlider } from "@/components/site/hero-slider";
import { Reveal } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { InfraCard } from "@/components/site/infra-card";
import { ApartmentCard } from "@/components/site/apartment-card";
import { GalleryGrid } from "@/components/site/gallery-grid";
import { NoticeCard } from "@/components/site/notice-card";
import { ContactForm } from "@/components/site/contact-form";
import { buttonClass } from "@/components/ui/button";
import { siteConfig, siteStats } from "@/config/site";
import { getGallery, getInfrastructures, getPublicNotices, getTypologies } from "@/services/public.service";

const pillars = [
  { icon: MapPin, title: "Localização em Talatona", text: "Numa das zonas residenciais de referência de Luanda Sul." },
  { icon: Trees, title: "Ambiente residencial", text: "Palmeiras, espaços verdes e zonas de estar ao ar livre." },
  { icon: Sparkles, title: "Conforto", text: "Piscinas, solário e áreas comuns cuidadas para o dia-a-dia." },
  { icon: ShieldCheck, title: "Segurança", text: "Entrada principal com portão e acesso identificado." },
  { icon: CalendarCheck2, title: "Organização", text: "Gestão digital de quotas, circulares e comunicados." },
  { icon: Users, title: "Qualidade de vida", text: "Um espaço pensado para famílias e convívio entre vizinhos." },
];

export default async function HomePage() {
  const [gallery, infras, typologies, notices] = await Promise.all([getGallery(), getInfrastructures(), getTypologies(), getPublicNotices()]);
  const featuredInfra = infras.filter((i) => i.confirmed).slice(0, 6);

  return (
    <>
      <HeroSlider />

      {/* Apresentação institucional */}
      <section id="apresentacao" className="relative scroll-mt-20 overflow-hidden py-24 sm:py-32">
        <div className="container-site grid items-center gap-16 lg:grid-cols-2">
          <Reveal className="relative">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-lift sm:aspect-[5/5.4]">
              <Image src="/images/laguna/lazer/piscina-com-palmeira.webp" alt="Piscina com palmeira no Residencial Laguna" fill sizes="(min-width:1024px) 45vw, 100vw" className="object-cover" />
            </div>
            <div className="absolute -right-4 -bottom-10 w-[55%] overflow-hidden rounded-3xl border-[6px] border-white shadow-lift sm:-right-10">
              <Image src="/images/laguna/fachadas/entrada-principal.webp" alt="Entrada principal do Residencial Laguna" width={525} height={328} className="h-auto w-full" />
            </div>
            <div className="absolute top-8 -left-3 rounded-2xl bg-navy-900 px-5 py-4 text-white shadow-lift sm:-left-8">
              <p className="text-[10px] tracking-[0.25em] text-gold-300 uppercase">Localização</p>
              <p className="mt-1 font-display text-2xl">Talatona</p>
              <p className="text-xs text-navy-200">Luanda · Angola</p>
            </div>
          </Reveal>

          <div>
            <SectionHeading
              className="mb-8"
              eyebrow="Sobre o Residencial Laguna"
              title={
                <>
                  Um lugar para viver <em className="text-gold-600">com tranquilidade</em>
                </>
              }
              description="Situado em Talatona, o Residencial Laguna reúne edifícios residenciais em torno de um espaço central de lazer, com piscinas, palmeiras e zonas de estar ao ar livre — um ambiente pensado para o conforto e a qualidade de vida de quem lá vive."
            />
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {pillars.map((p, i) => (
                <Reveal key={p.title} delay={i * 0.06} className="group flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-navy-50 text-navy-700 transition-all duration-500 group-hover:bg-navy-900 group-hover:text-gold-300">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-navy-900">{p.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-graphite-500">{p.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.2}>
              <Link href="/sobre" className={buttonClass("primary", "lg", "group mt-10")}>
                Conhecer o condomínio <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Indicadores */}
      <section className="relative overflow-hidden bg-navy-950 py-20">
        <Image src="/images/laguna/lazer/piscina-vista-geral.webp" alt="" fill sizes="100vw" className="object-cover opacity-15" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/90 to-navy-950" />
        <div className="container-site relative">
          <div className="grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {siteStats.map((s, i) => (
              <Reveal key={s.label} delay={i * 0.08} className="bg-navy-950/80 p-8 backdrop-blur">
                <p className="text-[11px] font-semibold tracking-[0.22em] text-gold-400 uppercase">{s.label}</p>
                <p className={`mt-4 font-display ${s.value ? "text-6xl text-white" : "text-3xl text-white/60 italic"}`}>{s.value ?? "Por confirmar"}</p>
                <p className="mt-3 text-xs leading-relaxed text-navy-200/70">{s.hint}</p>
              </Reveal>
            ))}
          </div>
          <p className="mt-5 text-center text-xs text-navy-300/60">Os indicadores oficiais serão publicados após confirmação pela administração do condomínio.</p>
        </div>
      </section>

      {/* Infraestruturas */}
      <section className="bg-graphite-50 py-24 sm:py-32">
        <div className="container-site">
          <SectionHeading
            eyebrow="Infraestruturas"
            title={
              <>
                Espaços pensados para <em className="text-gold-600">o seu bem-estar</em>
              </>
            }
            description="Infraestruturas identificadas nas fotografias reais do condomínio."
            action={
              <Link href="/infraestruturas" className={buttonClass("outline", "lg", "group")}>
                Ver todas <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            }
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredInfra.map((infra, i) => (
              <Reveal key={infra.slug} delay={(i % 3) * 0.08}>
                <InfraCard infra={infra} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Apartamentos */}
      <section className="py-24 sm:py-32">
        <div className="container-site">
          <SectionHeading
            eyebrow="Apartamentos"
            title={
              <>
                Tipologias para <em className="text-gold-600">cada família</em>
              </>
            }
            description="T2 e T3 apresentados como exemplos iniciais. As tipologias, áreas e características definitivas estão sujeitas a confirmação."
            action={
              <Link href="/apartamentos" className={buttonClass("outline", "lg", "group")}>
                Ver apartamentos <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            }
          />
          <div className="grid gap-8 md:grid-cols-2">
            {typologies.map((t, i) => (
              <Reveal key={t.slug} delay={i * 0.1}>
                <ApartmentCard typology={t} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Galeria */}
      <section className="bg-graphite-50 py-24 sm:py-32">
        <div className="container-site">
          <SectionHeading align="center" eyebrow="Galeria" title="O Residencial Laguna em imagens" description="Fotografias reais do condomínio. Clique para ampliar." />
          <GalleryGrid images={gallery.filter((g) => !g.detailOf).concat(gallery.filter((g) => g.id === "piscina-infantil" || g.id === "pergola-e-jardim"))} filterable={false} />
          <div className="mt-10 text-center">
            <Link href="/galeria" className={buttonClass("primary", "lg", "group")}>
              Ver Galeria Completa <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* Comunicados */}
      <section className="py-24 sm:py-32">
        <div className="container-site">
          <SectionHeading
            eyebrow="Comunicados"
            title="Notícias e comunicados recentes"
            description="Os comunicados abaixo são conteúdo de teste, criado para demonstrar o funcionamento do portal."
            action={
              <Link href="/comunicados" className={buttonClass("outline", "lg", "group")}>
                Todos os comunicados <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            }
          />
          <div className="grid gap-6 md:grid-cols-3">
            {notices.slice(0, 3).map((n, i) => (
              <Reveal key={n.slug} delay={i * 0.08}>
                <NoticeCard notice={n} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Contacto */}
      <section className="relative overflow-hidden bg-navy-950 py-24 sm:py-32">
        <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl" />
        <div className="container-site relative grid gap-14 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <SectionHeading
              className="mb-8"
              light
              eyebrow="Contactos"
              title={
                <>
                  Fale <em className="text-gold-300">connosco</em>
                </>
              }
              description="Tem alguma questão sobre o Residencial Laguna? Envie-nos uma mensagem."
            />
            <ul className="space-y-4 text-sm text-navy-100">
              <li className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-gold-400" /> {siteConfig.location.full}
              </li>
            </ul>
            <p className="mt-6 text-xs leading-relaxed text-navy-300/70">Telefone e email oficiais serão publicados após confirmação pela administração.</p>
          </div>
          <Reveal className="rounded-[2rem] bg-white p-6 shadow-lift sm:p-10 lg:col-span-3">
            <ContactForm />
          </Reveal>
        </div>
      </section>
    </>
  );
}
