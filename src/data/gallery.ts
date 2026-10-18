import type { GalleryCategory, GalleryImage } from "@/types";

/**
 * Fotografias reais do Residencial Laguna.
 * As entradas com `detailOf` são recortes (detalhes) de uma fotografia original,
 * sem qualquer alteração de conteúdo.
 */
export const galleryImages: GalleryImage[] = [
  {
    id: "piscina-vista-geral",
    src: "/images/laguna/lazer/piscina-vista-geral.webp",
    title: "Piscina e área de lazer",
    alt: "Vista geral da piscina do Residencial Laguna entre dois edifícios, com espreguiçadeiras, palmeiras, guarda-sóis e piscina infantil",
    category: "lazer",
    width: 950,
    height: 712,
  },
  {
    id: "piscina-com-palmeira",
    src: "/images/laguna/lazer/piscina-com-palmeira.webp",
    title: "Piscina com ilha de palmeira",
    alt: "Piscina com uma palmeira numa pequena ilha ajardinada, deck em mosaico e edifício residencial ao fundo",
    category: "lazer",
    width: 1016,
    height: 675,
  },
  {
    id: "piscina-e-deck",
    src: "/images/laguna/lazer/piscina-e-deck.webp",
    title: "Deck da piscina",
    alt: "Deck da piscina com vasos de palmeiras, espreguiçadeiras e edifícios residenciais sob céu azul",
    category: "lazer",
    width: 800,
    height: 532,
    credit: "Fotografia com marca de água Angocasa",
  },
  {
    id: "entrada-principal",
    src: "/images/laguna/fachadas/entrada-principal.webp",
    title: "Entrada principal",
    alt: "Entrada principal do Residencial Laguna com portão, sinalética Laguna, palmeiras e edifícios ao fundo",
    category: "fachadas",
    width: 525,
    height: 328,
  },
  {
    id: "edificio-residencial",
    src: "/images/laguna/fachadas/edificio-residencial.webp",
    title: "Edifício residencial",
    alt: "Fachada de um dos edifícios residenciais com janelas e varandas, vista a partir da zona da piscina",
    category: "fachadas",
    width: 636,
    height: 430,
    detailOf: "piscina-com-palmeira",
  },
  {
    id: "blocos-residenciais",
    src: "/images/laguna/fachadas/blocos-residenciais.webp",
    title: "Blocos residenciais",
    alt: "Fachada longa de um bloco residencial com várias janelas e palmeiras em primeiro plano",
    category: "fachadas",
    width: 520,
    height: 400,
    detailOf: "piscina-vista-geral",
  },
  {
    id: "piscina-infantil",
    src: "/images/laguna/lazer/piscina-infantil.webp",
    title: "Piscina infantil",
    alt: "Piscina infantil circular em mosaico azul rodeada por vasos com palmeiras",
    category: "lazer",
    width: 410,
    height: 292,
    detailOf: "piscina-vista-geral",
  },
  {
    id: "zona-de-estar",
    src: "/images/laguna/areas-exteriores/zona-de-estar.webp",
    title: "Zona de estar exterior",
    alt: "Mesas com cadeiras e guarda-sóis junto à piscina, com plantas em vasos",
    category: "areas-exteriores",
    width: 560,
    height: 332,
    detailOf: "piscina-vista-geral",
  },
  {
    id: "pergola-e-jardim",
    src: "/images/laguna/areas-exteriores/pergola-e-jardim.webp",
    title: "Pérgola e espaços verdes",
    alt: "Pérgola em madeira, vasos com palmeiras e deck junto à piscina",
    category: "areas-exteriores",
    width: 470,
    height: 355,
    detailOf: "piscina-com-palmeira",
  },
];

export const galleryCategories: { id: GalleryCategory | "todas"; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "fachadas", label: "Fachadas e edifícios" },
  { id: "lazer", label: "Piscinas e lazer" },
  { id: "areas-exteriores", label: "Áreas exteriores e jardins" },
];

export const heroSlides = [
  {
    image: "/images/laguna/lazer/piscina-vista-geral.webp",
    eyebrow: "Talatona · Luanda",
    title: "Residencial Laguna",
    highlight: "O Seu Novo Lar em Talatona",
    text: "Um espaço pensado para proporcionar conforto, segurança e qualidade de vida.",
    cta: { label: "Conhecer o condomínio", href: "/sobre" },
  },
  {
    image: "/images/laguna/lazer/piscina-com-palmeira.webp",
    eyebrow: "Lazer e tranquilidade",
    title: "Viva com Conforto",
    highlight: "e Exclusividade",
    text: "Um ambiente residencial onde a tranquilidade e a modernidade se encontram.",
    cta: { label: "Ver infraestruturas", href: "/infraestruturas" },
  },
  {
    image: "/images/laguna/lazer/piscina-e-deck.webp",
    eyebrow: "Residencial Laguna",
    title: "Uma Nova Experiência",
    highlight: "de Viver",
    text: "Conheça o Residencial Laguna e descubra um novo conceito de habitação.",
    cta: { label: "Explorar a galeria", href: "/galeria" },
  },
  {
    image: "/images/laguna/fachadas/entrada-principal.webp",
    eyebrow: "Bem-vindo",
    title: "Chegar a Casa",
    highlight: "em Talatona",
    text: "Uma entrada cuidada e um acesso organizado ao condomínio.",
    cta: { label: "Ver apartamentos", href: "/apartamentos" },
  },
];
