import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { ContactForm } from "@/components/site/contact-form";
import { LocationMap } from "@/components/site/location-map";
import { Reveal } from "@/components/site/reveal";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Contactos", description: "Contacte o Residencial Laguna, em Talatona, Luanda." };

export default function ContactosPage() {
  const c = siteConfig.contacts;
  const items = [
    { icon: MapPin, label: "Morada", value: `${siteConfig.location.address}, Luanda, Angola` },
    { icon: Phone, label: "Telefone", value: c.phone },
    { icon: Phone, label: "Administração", value: c.adminPhone ? `${c.adminPhone} · ${siteConfig.administrator.name}` : null },
    { icon: Mail, label: "Email", value: c.email },
    { icon: Clock, label: "Atendimento", value: c.officeHours },
  ];
  return (
    <>
      <PageHero image="/images/laguna/fachadas/entrada-principal.webp" eyebrow="Contactos" title="Fale connosco" description="Envie-nos a sua mensagem ou visite-nos em Talatona." crumbs={[{ label: "Contactos" }]} />
      <section className="py-20">
        <div className="container-site grid gap-12 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-2">
            {items.map((it, i) => (
              <Reveal key={it.label} delay={i * 0.06} className="flex items-start gap-4 rounded-2xl border border-graphite-100 bg-white p-5 shadow-soft">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-navy-900 text-gold-300">
                  <it.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.2em] text-graphite-400 uppercase">{it.label}</p>
                  <p className={it.value ? "mt-1 font-medium text-navy-900" : "mt-1 text-sm text-graphite-400 italic"}>{it.value ?? "Por confirmar pela administração"}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="rounded-[2rem] border border-graphite-100 bg-white p-6 shadow-lift sm:p-10 lg:col-span-3">
            <h2 className="mb-1 font-display text-3xl text-navy-900">Envie uma mensagem</h2>
            <p className="mb-8 text-sm text-graphite-500">Responderemos com a maior brevidade possível.</p>
            <ContactForm />
          </Reveal>
        </div>
        <div className="container-site mt-16">
          <LocationMap className="h-[420px]" />
        </div>
      </section>
    </>
  );
}
