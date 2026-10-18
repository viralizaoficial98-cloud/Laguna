import Image from "next/image";
import type { Infrastructure } from "@/types";
import { InfraIcon } from "./infra-icon";

export function InfraCard({ infra }: { infra: Infrastructure }) {
  return (
    <article className="group relative h-full overflow-hidden rounded-3xl bg-navy-950 shadow-soft transition-all duration-500 hover:-translate-y-1 hover:shadow-lift">
      <div className="relative aspect-[4/5] sm:aspect-[4/4.6]">
        <Image src={infra.image} alt={infra.name} fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/40 to-transparent" />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gold-400/40 bg-navy-950/40 text-gold-300 backdrop-blur transition-colors duration-500 group-hover:bg-gold-400 group-hover:text-navy-950">
            <InfraIcon name={infra.icon} className="h-5 w-5" />
          </span>
          {!infra.confirmed && <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-medium tracking-wide text-white backdrop-blur">A confirmar</span>}
        </div>
        <h3 className="font-display text-2xl text-white">{infra.name}</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/70">{infra.summary}</p>
      </div>
    </article>
  );
}
