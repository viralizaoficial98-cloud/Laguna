import { ArrowUpRight, CalendarDays, FlaskConical } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { PublicNotice } from "@/types";
import { formatDate } from "@/lib/utils";

export function NoticeCard({ notice }: { notice: PublicNotice }) {
  return (
    <Link href={`/comunicados/${notice.slug}`} className="group flex h-full flex-col overflow-hidden rounded-3xl border border-graphite-100 bg-white shadow-soft transition-all duration-500 hover:-translate-y-1 hover:shadow-lift">
      {notice.image && (
        <div className="relative aspect-[16/9] overflow-hidden">
          <Image src={notice.image} alt="" fill sizes="(min-width:1024px) 33vw, 100vw" className="object-cover transition-transform duration-[1.2s] group-hover:scale-105" />
          <span className="absolute top-4 left-4 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold text-navy-900">{notice.category}</span>
        </div>
      )}
      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center gap-3 text-xs text-graphite-500">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> {formatDate(notice.date, { day: "2-digit", month: "long", year: "numeric" })}
          </span>
          {notice.isDemo && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold-50 px-2 py-0.5 text-[10px] font-medium text-gold-800">
              <FlaskConical className="h-3 w-3" /> Conteúdo de teste
            </span>
          )}
        </div>
        <h3 className="mt-3 font-display text-2xl leading-tight text-navy-900 transition-colors group-hover:text-gold-700">{notice.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-graphite-500">{notice.excerpt}</p>
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-900">
          Ler comunicado <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </Link>
  );
}
