import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function PageHero({ title, eyebrow, description, image, crumbs = [] }: { title: string; eyebrow?: string; description?: string; image: string; crumbs?: { href?: string; label: string }[] }) {
  return (
    <section className="relative flex min-h-[420px] items-end overflow-hidden bg-navy-950 pt-28 pb-14 sm:min-h-[480px]">
      <Image src={image} alt="" fill preload sizes="100vw" quality={85} className="animate-kenburns object-cover opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/60 to-navy-950/30" />
      <div className="container-site relative">
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-white/60">
          <Link href="/" className="hover:text-white">
            Início
          </Link>
          {crumbs.map((c) => (
            <span key={c.label} className="inline-flex items-center gap-1.5">
              <ChevronRight className="h-3 w-3" />
              {c.href ? (
                <Link href={c.href} className="hover:text-white">
                  {c.label}
                </Link>
              ) : (
                <span className="text-gold-300">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
        {eyebrow && <p className="eyebrow mb-4 text-gold-300">{eyebrow}</p>}
        <h1 className="max-w-3xl font-display text-5xl leading-[1] font-medium text-white sm:text-6xl">{title}</h1>
        {description && <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/75">{description}</p>}
      </div>
    </section>
  );
}
