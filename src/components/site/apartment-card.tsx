import { ArrowRight, BedDouble, Bath, Info } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Typology } from "@/types";

export function ApartmentCard({ typology }: { typology: Typology }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-graphite-100 bg-white shadow-soft transition-all duration-500 hover:-translate-y-1 hover:shadow-lift">
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image src={typology.images[0]} alt={`${typology.name} — Residencial Laguna`} fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover transition-transform duration-[1.2s] group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/60 to-transparent" />
        <span className="absolute top-5 left-5 rounded-full bg-white/95 px-4 py-1.5 font-display text-2xl font-semibold text-navy-900 shadow-soft">{typology.label}</span>
        {!typology.confirmed && (
          <span className="absolute top-6 right-5 inline-flex items-center gap-1 rounded-full bg-navy-950/60 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur">
            <Info className="h-3 w-3" /> Tipologia de exemplo
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-7">
        <h3 className="font-display text-3xl text-navy-900">{typology.name}</h3>
        <div className="mt-3 flex gap-5 text-sm text-graphite-600">
          <span className="inline-flex items-center gap-1.5">
            <BedDouble className="h-4 w-4 text-gold-600" /> {typology.bedrooms} quartos
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Bath className="h-4 w-4 text-gold-600" /> WC por confirmar
          </span>
        </div>
        <p className="mt-4 flex-1 text-sm leading-relaxed text-graphite-500">{typology.summary}</p>
        <div className="mt-6 flex items-center justify-between border-t border-graphite-100 pt-5">
          <span className="text-xs text-graphite-400">Áreas e preços por confirmar</span>
          <Link href={`/apartamentos/${typology.slug}`} className="inline-flex items-center gap-2 text-sm font-semibold text-navy-900 transition-colors hover:text-gold-600">
            Ver detalhes <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </article>
  );
}
