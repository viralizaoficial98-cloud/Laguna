import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { GalleryGrid } from "@/components/site/gallery-grid";
import { getGallery } from "@/services/public.service";

export const metadata: Metadata = { title: "Galeria", description: "Fotografias reais do Residencial Laguna, em Talatona." };

export default async function GaleriaPage() {
  const images = await getGallery();
  return (
    <>
      <PageHero image="/images/laguna/lazer/piscina-e-deck.webp" eyebrow="Galeria" title="O Laguna em imagens" description="Fotografias reais do condomínio, organizadas por categoria. Clique numa imagem para a ampliar." crumbs={[{ label: "Galeria" }]} />
      <section className="py-20">
        <div className="container-site">
          <GalleryGrid images={images} />
          <p className="mt-10 text-center text-xs text-graphite-400">
            Algumas imagens são detalhes (recortes) das fotografias originais. Fotografias dos interiores dos apartamentos serão adicionadas brevemente.
          </p>
        </div>
      </section>
    </>
  );
}
