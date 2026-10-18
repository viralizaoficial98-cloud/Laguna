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
  location: {
    district: "Talatona",
    city: "Luanda",
    country: "Angola",
    full: "Talatona, Luanda, Angola",
    mapQuery: "Residencial Laguna, Talatona, Luanda, Angola",
  },
  contacts: {
    /** Por confirmar pela administração. Deixar null até haver dados oficiais. */
    phone: null as string | null,
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
    value: null,
    hint: "Número oficial a confirmar pela administração",
    confirmed: false,
  },
  {
    label: "Apartamentos",
    value: null,
    hint: "Número oficial a confirmar pela administração",
    confirmed: false,
  },
  {
    label: "Tipologias",
    value: "T2 · T3",
    hint: "Exemplos iniciais, sujeitos a confirmação",
    confirmed: false,
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
