/**
 * Informação institucional do Residencial Laguna.
 *
 * Regra: só os campos com `confirmed: true` são apresentados como factos.
 * Valores por confirmar aparecem com a indicação "Por confirmar".
 * Não inventar telefones, emails ou números oficiais — preencher apenas
 * quando forem fornecidos pela administração do condomínio.
 */
export const siteConfig = {
  name: "Residencial Laguna",
  shortName: "Laguna",
  tagline: "O seu novo lar em Talatona",
  description:
    "Portal institucional do Residencial Laguna, em Talatona, Luanda — infraestruturas, apartamentos, galeria, comunicados e área reservada aos moradores.",
  url: "https://residenciallaguna.ao",
  /** Administrador oficial do condomínio. */
  administrator: {
    name: "José Leiria",
    title: "Administrador do Condomínio",
    signatureTitle: "O Administrador",
  },
  /** Referência usada na numeração das circulares (ex.: 04/ADMLR/2026). */
  circularRef: "ADMLR",
  location: {
    street: "Via S 15",
    address: "Via S 15, Talatona",
    district: "Talatona",
    city: "Luanda",
    country: "Angola",
    full: "Talatona, Luanda, Angola",
    mapQuery: "Residencial Laguna, Talatona, Luanda, Angola",
  },
  /** Designação usada no rodapé dos documentos oficiais (conforme a Circular N.º 04/ADMLR/2025). */
  letterheadName: "Condomínio Laguna Residencial",
  contacts: {
    /** Telefone do rodapé oficial (Circular N.º 04/ADMLR/2025). */
    phone: "+244 945 177 760" as string | null,
    /** Contacto da Administração indicado na Circular N.º 04/ADMLR/2025. */
    adminPhone: "+244 927 527 294" as string | null,
    /** Por confirmar pela administração. */
    email: null as string | null,
    whatsapp: null as string | null,
    officeHours: null as string | null,
  },
  logo: {
    color: "/images/brand/logo-laguna.png",
    white: "/images/brand/logo-laguna-branco.png",
    width: 293,
    height: 71,
  },
};

export interface SiteStat {
  label: string;
  value: string | null;
  hint: string;
  confirmed: boolean;
}

/** Indicadores do condomínio. Editar aqui quando os valores forem confirmados. */
export const siteStats: SiteStat[] = [
  {
    label: "Piscinas",
    value: "2",
    hint: "Piscina principal e piscina infantil, visíveis nas fotografias",
    confirmed: true,
  },
  {
    label: "Blocos residenciais",
    value: "10",
    hint: "Blocos 01 a 10, conforme documentação da Administração",
    confirmed: true,
  },
  {
    label: "Apartamentos",
    value: "100",
    hint: "80 T2 e 20 Duplex, distribuídos pelos 10 blocos",
    confirmed: true,
  },
  {
    label: "Tipologias",
    value: "T2 · Duplex",
    hint: "Exclusivamente T2 e Duplex (3 quartos, sala e varanda)",
    confirmed: true,
  },
];

export const publicNav = [
  { href: "/", label: "Início" },
  { href: "/sobre", label: "Sobre" },
  { href: "/infraestruturas", label: "Infraestruturas" },
  { href: "/apartamentos", label: "Apartamentos" },
  { href: "/galeria", label: "Galeria" },
  { href: "/comunicados", label: "Comunicados" },
  { href: "/contactos", label: "Contactos" },
];
