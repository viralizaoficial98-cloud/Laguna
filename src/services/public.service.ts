/**
 * Camada de serviços do portal público.
 * Hoje lê dados locais; no futuro poderá consultar uma API/CMS sem alterar as páginas.
 */
import { galleryImages } from "@/data/gallery";
import { infrastructures, publicNotices, typologies } from "@/data/public-content";

export async function getGallery() {
  return galleryImages;
}

export async function getInfrastructures() {
  return infrastructures;
}

export async function getTypologies() {
  return typologies;
}

export async function getTypology(slug: string) {
  return typologies.find((t) => t.slug === slug) ?? null;
}

export async function getPublicNotices() {
  return [...publicNotices].sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPublicNotice(slug: string) {
  return publicNotices.find((n) => n.slug === slug) ?? null;
}
