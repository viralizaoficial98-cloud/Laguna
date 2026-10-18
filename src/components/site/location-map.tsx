import { siteConfig } from "@/config/site";

/** Mapa incorporado (Google Maps, sem chave de API). Localização aproximada por pesquisa. */
export function LocationMap({ className = "h-[380px]" }: { className?: string }) {
  const src = `https://www.google.com/maps?q=${encodeURIComponent(siteConfig.location.mapQuery)}&output=embed`;
  return (
    <div className={`relative overflow-hidden rounded-3xl border border-graphite-100 bg-graphite-100 shadow-soft ${className}`}>
      <iframe title="Localização do Residencial Laguna em Talatona" src={src} className="absolute inset-0 h-full w-full grayscale-[35%]" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-[11px] text-graphite-600 shadow-soft">Localização aproximada — a confirmar</span>
    </div>
  );
}
