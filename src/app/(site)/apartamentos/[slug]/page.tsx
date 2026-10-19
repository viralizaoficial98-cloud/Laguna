import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BedDouble, Check, Info, Ruler, Bath, Mail } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { GalleryGrid } from "@/components/site/gallery-grid";
import { buttonClass } from "@/components/ui/button";
import { getGallery, getTypologies, getTypology } from "@/services/public.service";

export async function generateStaticParams() {
  return (await getTypologies()).map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/apartamentos/[slug]">): Promise<Metadata> {
  const t = await getTypology((await params).slug);
  return { title: t?.name ?? "Apartamento" };
}

export default async function ApartamentoPage({ params }: PageProps<"/apartamentos/[slug]">) {
  const { slug } = await params;
  const t = await getTypology(slug);
  if (!t) notFound();
  const gallery = (await getGallery()).filter((g) => t.images.includes(g.src));

  const specs = [
    { icon: BedDouble, label: "Quartos", value: String(t.bedrooms) },
    { icon: Bath, label: "Casas de banho", value: t.bathrooms ? String(t.bathrooms) : null },
    { icon: Ruler, label: "Área", value: t.areaM2 ? `${t.areaM2} m²` : null },
  ];

  return (
    <>
      <PageHero image={t.images[0]} eyebrow="Apartamentos" title={t.name} description={t.summary} crumbs={[{ href: "/apartamentos", label: "Apartamentos" }, { label: t.label }]} />
      <section className="py-20">
        <div className="container-site grid gap-14 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {!t.confirmed && (
              <div className="mb-8 flex items-start gap-3 rounded-2xl border border-gold-200 bg-gold-50/70 px-5 py-4 text-sm text-gold-900">
                <Info className="mt-0.5 h-5 w-5 shrink-0" />
                Tipologia de exemplo. As características definitivas e as plantas serão publicadas após confirmação.
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              {specs.map((s) => (
                <div key={s.label} className="rounded-2xl border border-graphite-100 bg-white p-5 shadow-soft">
                  <s.icon className="h-5 w-5 text-gold-600" />
                  <p className="mt-3 text-xs tracking-wider text-graphite-400 uppercase">{s.label}</p>
                  <p className={s.value ? "font-display text-3xl text-navy-900" : "mt-1 text-sm text-graphite-400 italic"}>{s.value ?? "Por confirmar"}</p>
                </div>
              ))}
            </div>
            <h2 className="mt-14 font-display text-3xl text-navy-900">Características</h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {t.features.map((f) => (
                <li key={f} className="flex items-center gap-3 text-graphite-700">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy-900 text-gold-300">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <h2 className="mt-14 mb-6 font-display text-3xl text-navy-900">Fotografias do condomínio</h2>
            <GalleryGrid images={gallery} filterable={false} />
            <p className="mt-2 text-xs text-graphite-400">Fotografias dos interiores a disponibilizar.</p>
          </div>
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-3xl bg-navy-950 p-8 text-white shadow-lift">
              <p className="eyebrow text-gold-300">Interessado?</p>
              <p className="mt-4 font-display text-3xl">Peça mais informações sobre o {t.label}</p>
              <p className="mt-3 text-sm text-navy-200/80">A administração poderá esclarecer disponibilidade, áreas e condições.</p>
              <Link href="/contactos" className={buttonClass("gold", "lg", "mt-8 w-full")}>
                <Mail className="h-4 w-4" /> Contactar
              </Link>
            </div>
            <Link href="/apartamentos" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-navy-900 hover:text-gold-600">
              <ArrowLeft className="h-4 w-4" /> Todas as tipologias
            </Link>
          </aside>
        </div>
      </section>
    </>
  );
}
