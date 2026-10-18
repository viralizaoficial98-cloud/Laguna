import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CalendarDays, FlaskConical } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { NoticeCard } from "@/components/site/notice-card";
import { getPublicNotice, getPublicNotices } from "@/services/public.service";
import { formatDate } from "@/lib/utils";

export async function generateStaticParams() {
  return (await getPublicNotices()).map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: PageProps<"/comunicados/[slug]">): Promise<Metadata> {
  const n = await getPublicNotice((await params).slug);
  return { title: n?.title ?? "Comunicado" };
}

export default async function ComunicadoPage({ params }: PageProps<"/comunicados/[slug]">) {
  const { slug } = await params;
  const notice = await getPublicNotice(slug);
  if (!notice) notFound();
  const others = (await getPublicNotices()).filter((n) => n.slug !== slug).slice(0, 2);

  return (
    <>
      <PageHero image={notice.image ?? "/images/laguna/lazer/piscina-vista-geral.webp"} eyebrow={notice.category} title={notice.title} crumbs={[{ href: "/comunicados", label: "Comunicados" }, { label: notice.title }]} />
      <section className="py-16">
        <div className="container-site grid gap-14 lg:grid-cols-3">
          <article className="lg:col-span-2">
            <div className="mb-8 flex flex-wrap items-center gap-3 text-sm text-graphite-500">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" /> {formatDate(notice.date, { day: "2-digit", month: "long", year: "numeric" })}
              </span>
              {notice.isDemo && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gold-50 px-2.5 py-1 text-xs font-medium text-gold-800">
                  <FlaskConical className="h-3.5 w-3.5" /> Conteúdo de teste
                </span>
              )}
            </div>
            <div className="space-y-5 text-lg leading-relaxed text-graphite-700">
              {notice.body.map((p, i) => (
                <p key={i} className={i === 0 && notice.isDemo ? "rounded-2xl bg-graphite-50 p-4 text-base text-graphite-500 italic" : ""}>
                  {p}
                </p>
              ))}
            </div>
            {notice.image && (
              <div className="relative mt-10 aspect-[16/9] overflow-hidden rounded-3xl">
                <Image src={notice.image} alt="" fill sizes="(min-width:1024px) 66vw, 100vw" className="object-cover" />
              </div>
            )}
            <Link href="/comunicados" className="mt-10 inline-flex items-center gap-2 text-sm font-semibold text-navy-900 hover:text-gold-600">
              <ArrowLeft className="h-4 w-4" /> Voltar aos comunicados
            </Link>
          </article>
          <aside className="space-y-6">
            <p className="eyebrow">Outros comunicados</p>
            {others.map((n) => (
              <NoticeCard key={n.slug} notice={n} />
            ))}
          </aside>
        </div>
      </section>
    </>
  );
}
