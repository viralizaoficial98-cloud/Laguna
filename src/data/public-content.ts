import type { Infrastructure, PublicNotice, Typology } from "@/types";

/**
 * Infraestruturas identificadas nas fotografias reais.
 * `confirmed: false` → é apresentada com a indicação "A confirmar".
 */
export const infrastructures: Infrastructure[] = [
  {
    slug: "piscina-principal",
    name: "Piscina principal",
    summary: "Piscina de linhas orgânicas com ilha ajardinada e palmeira central.",
    description:
      "Situada no coração do condomínio, entre os edifícios residenciais, a piscina principal é rodeada por deck em mosaico e palmeiras, criando um ambiente de descanso ao ar livre.",
    image: "/images/laguna/lazer/piscina-com-palmeira.webp",
    icon: "waves",
    confirmed: true,
  },
  {
    slug: "piscina-infantil",
    name: "Piscina infantil",
    summary: "Piscina circular de baixa profundidade, dedicada aos mais novos.",
    description:
      "Uma piscina independente, em mosaico azul, pensada para as crianças desfrutarem da água em segurança junto da família.",
    image: "/images/laguna/lazer/piscina-infantil.webp",
    icon: "baby",
    confirmed: true,
  },
  {
    slug: "solario",
    name: "Solário e espreguiçadeiras",
    summary: "Deck amplo com espreguiçadeiras alinhadas junto à água.",
    description:
      "O solário acompanha a piscina principal e dispõe de espreguiçadeiras para momentos de descanso e convívio ao sol.",
    image: "/images/laguna/lazer/piscina-vista-geral.webp",
    icon: "sun",
    confirmed: true,
  },
  {
    slug: "zona-de-estar",
    name: "Zona de estar exterior",
    summary: "Mesas com guarda-sóis para refeições leves e convívio.",
    description:
      "Espaços de estar com mesas, cadeiras e guarda-sóis, distribuídos pelo deck e acompanhados por vasos com palmeiras.",
    image: "/images/laguna/areas-exteriores/zona-de-estar.webp",
    icon: "umbrella",
    confirmed: true,
  },
  {
    slug: "espacos-verdes",
    name: "Pérgola e espaços verdes",
    summary: "Palmeiras, vasos ornamentais e pérgola em madeira.",
    description:
      "A vegetação tropical — palmeiras e plantas ornamentais — e a pérgola em madeira suavizam a arquitectura e oferecem sombra natural.",
    image: "/images/laguna/areas-exteriores/pergola-e-jardim.webp",
    icon: "trees",
    confirmed: true,
  },
  {
    slug: "entrada-principal",
    name: "Entrada principal",
    summary: "Acesso com portão e sinalética do condomínio.",
    description:
      "A entrada do Residencial Laguna dispõe de portão e zona de acesso identificada. Os serviços de portaria e segurança deverão ser confirmados pela administração.",
    image: "/images/laguna/fachadas/entrada-principal.webp",
    icon: "door",
    confirmed: true,
  },
  {
    slug: "parque-infantil",
    name: "Parque infantil",
    summary: "Equipamento infantil aparentemente visível junto à piscina.",
    description:
      "Nas fotografias é visível um escorrega infantil próximo da zona da piscina. A existência e as características do parque infantil aguardam confirmação.",
    image: "/images/laguna/lazer/piscina-e-deck.webp",
    icon: "blocks",
    confirmed: false,
  },
];

/**
 * Tipologias existentes no Residencial Laguna: exclusivamente T2, T3 e T4.
 * Áreas, casas de banho e preços aguardam confirmação da Administração.
 */
export const typologies: Typology[] = [
  {
    slug: "t2",
    name: "Apartamento T2",
    label: "T2",
    bedrooms: 2,
    bathrooms: 0,
    summary: "Uma tipologia equilibrada para casais e pequenas famílias, com acesso às áreas comuns e de lazer do condomínio.",
    features: ["2 quartos", "Sala e cozinha", "Acesso às piscinas e áreas comuns"],
    images: ["/images/laguna/fachadas/edificio-residencial.webp", "/images/laguna/lazer/piscina-com-palmeira.webp"],
    confirmed: true,
  },
  {
    slug: "t3",
    name: "Apartamento T3",
    label: "T3",
    bedrooms: 3,
    bathrooms: 0,
    summary: "Mais espaço para a família, combinando conforto interior com a tranquilidade de um condomínio com zonas de lazer.",
    features: ["3 quartos", "Sala e cozinha", "Acesso às piscinas e áreas comuns"],
    images: ["/images/laguna/fachadas/blocos-residenciais.webp", "/images/laguna/lazer/piscina-vista-geral.webp"],
    confirmed: true,
  },
  {
    slug: "t4",
    name: "Apartamento T4",
    label: "T4",
    bedrooms: 4,
    bathrooms: 0,
    summary: "A tipologia mais ampla do condomínio, pensada para famílias que precisam de mais quartos e espaço.",
    features: ["4 quartos", "Sala e cozinha", "Acesso às piscinas e áreas comuns"],
    images: ["/images/laguna/lazer/piscina-e-deck.webp", "/images/laguna/fachadas/entrada-principal.webp"],
    confirmed: true,
  },
];

/** Comunicados públicos — CONTEÚDO DE TESTE, claramente identificado. */
export const publicNotices: PublicNotice[] = [
  {
    slug: "manutencao-preventiva-piscinas",
    title: "Manutenção preventiva das piscinas",
    excerpt: "Exemplo de comunicado: interrupção temporária do acesso às piscinas para limpeza e tratamento da água.",
    body: [
      "Este é um comunicado de demonstração, criado apenas para ilustrar o funcionamento do portal.",
      "Informa-se que, no âmbito do plano de manutenção preventiva, as piscinas estarão encerradas durante o período de limpeza e tratamento da água.",
      "Agradecemos a compreensão de todos os moradores.",
    ],
    date: "2026-10-14",
    category: "Manutenção",
    image: "/images/laguna/lazer/piscina-com-palmeira.webp",
    isDemo: true,
  },
  {
    slug: "convocatoria-assembleia-geral",
    title: "Convocatória para Assembleia Geral",
    excerpt: "Exemplo de comunicado: convocatória para a assembleia de condóminos e respectiva ordem de trabalhos.",
    body: [
      "Este é um comunicado de demonstração, criado apenas para ilustrar o funcionamento do portal.",
      "Convocam-se todos os condóminos para a Assembleia Geral ordinária, onde serão apresentados o relatório de contas e o plano de actividades.",
      "A ordem de trabalhos completa será disponibilizada na Área de Moradores.",
    ],
    date: "2026-10-06",
    category: "Assembleia",
    image: "/images/laguna/fachadas/entrada-principal.webp",
    isDemo: true,
  },
  {
    slug: "actualizacao-registo-visitantes",
    title: "Actualização do registo de visitantes",
    excerpt: "Exemplo de comunicado: novas orientações para a identificação de visitantes na entrada principal.",
    body: [
      "Este é um comunicado de demonstração, criado apenas para ilustrar o funcionamento do portal.",
      "Para reforço da organização dos acessos, todos os visitantes deverão ser identificados na entrada principal e associados ao apartamento de destino.",
      "Os moradores podem antecipar visitas através da Área de Moradores.",
    ],
    date: "2026-09-25",
    category: "Segurança",
    image: "/images/laguna/lazer/piscina-vista-geral.webp",
    isDemo: true,
  },
];
