import type { ReactNode } from "react";
import Image from "next/image";
import { DEMO_TODAY } from "@/data/management";
import { formatDate } from "@/lib/utils";

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 19 ? "Boa tarde" : "Boa noite";
}

export function Welcome({ name, subtitle, children, image = "/images/laguna/lazer/piscina-vista-geral.webp" }: { name: string; subtitle: ReactNode; children?: ReactNode; image?: string }) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-3xl bg-navy-950 px-6 py-7 text-white shadow-lift sm:px-8 sm:py-9">
      <Image src={image} alt="" fill sizes="100vw" className="object-cover opacity-25" />
      <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/90 to-navy-950/40" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.25em] text-gold-300 uppercase">{formatDate(DEMO_TODAY, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">
            {greeting()}, <em className="text-gold-300">{name.split(" ")[0]}</em>
          </h1>
          <div className="mt-2 text-sm text-navy-100/80">{subtitle}</div>
        </div>
        {children}
      </div>
    </div>
  );
}
