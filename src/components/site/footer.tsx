import { ArrowUpRight, MapPin, Clock, Phone, Mail } from "lucide-react";
import Link from "next/link";
import { publicNav, siteConfig } from "@/config/site";
import { Logo } from "./logo";

export function Footer() {
  const c = siteConfig.contacts;
  return (
    <footer className="relative overflow-hidden bg-navy-950 text-navy-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(196,154,74,0.12),transparent_55%)]" />
      <div className="container-site relative grid gap-12 py-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <Logo variant="white" className="h-10" />
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-navy-200/80">
            Um condomínio residencial em Talatona, pensado para proporcionar conforto, segurança e qualidade de vida.
          </p>
          <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-gold-300 transition hover:text-gold-200">
            Aceder à Área de Moradores <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="md:col-span-3">
          <p className="mb-5 text-[11px] font-semibold tracking-[0.25em] text-gold-400 uppercase">Navegação</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm md:grid-cols-1">
            {publicNav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="text-navy-200/80 transition hover:text-white">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-4">
          <p className="mb-5 text-[11px] font-semibold tracking-[0.25em] text-gold-400 uppercase">Contactos</p>
          <ul className="space-y-3.5 text-sm">
            <li className="flex gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
              <span>{siteConfig.location.full}</span>
            </li>
            <li className="flex gap-3">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
              <span className={c.phone ? "" : "text-navy-300/60 italic"}>{c.phone ?? "Telefone por confirmar"}</span>
            </li>
            <li className="flex gap-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
              <span className={c.email ? "" : "text-navy-300/60 italic"}>{c.email ?? "Email por confirmar"}</span>
            </li>
            <li className="flex gap-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
              <span className={c.officeHours ? "" : "text-navy-300/60 italic"}>{c.officeHours ?? "Horário de atendimento por confirmar"}</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="relative border-t border-white/10">
        <div className="container-site flex flex-col gap-2 py-6 text-xs text-navy-300/70 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Residencial Laguna · Talatona, Luanda</p>
          <p>Protótipo — Fase 1 (frontend). Conteúdos de teste identificados.</p>
        </div>
      </div>
    </footer>
  );
}
