/**
 * Modelos de domínio do Portal Residencial Laguna.
 * Estes tipos espelham o futuro esquema de base de dados (MySQL + Prisma),
 * pelo que os nomes e relações (ids) devem manter-se estáveis.
 */

export type Role = "admin_geral" | "administrador" | "financeiro" | "porteiro" | "morador";

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  /** Apenas para o login demonstrativo. Nunca guardar palavras-passe assim em produção. */
  password: string;
  role: Role;
  title: string;
  residentId?: string;
  phone?: string;
  status: "activo" | "inactivo";
  lastAccess?: string;
}

export interface Session {
  userId: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  residentId?: string;
  startedAt: string;
}

// ————— Portal público —————

export type GalleryCategory = "fachadas" | "lazer" | "areas-exteriores";

export interface GalleryImage {
  id: string;
  src: string;
  alt: string;
  title: string;
  category: GalleryCategory;
  width: number;
  height: number;
  /** Indica se é um recorte (detalhe) de outra fotografia original. */
  detailOf?: string;
  credit?: string;
}

export interface Infrastructure {
  slug: string;
  name: string;
  summary: string;
  description: string;
  image: string;
  icon: string;
  confirmed: boolean;
}

export interface Typology {
  slug: string;
  name: string;
  label: string;
  bedrooms: number;
  bathrooms: number;
  areaM2?: number;
  summary: string;
  features: string[];
  images: string[];
  /** Tipologias de exemplo, sujeitas a confirmação pela administração. */
  confirmed: boolean;
}

export interface PublicNotice {
  slug: string;
  title: string;
  excerpt: string;
  body: string[];
  date: string;
  category: "Manutenção" | "Assembleia" | "Segurança" | "Geral";
  image?: string;
  isDemo: boolean;
}

// ————— Gestão do condomínio —————

export type ApartmentStatus = "ocupado" | "disponivel" | "manutencao";
export type TypologyCode = "T1" | "T2" | "T3" | "T4";

export interface Apartment {
  id: string;
  block: string;
  number: string;
  floor: number;
  typology: TypologyCode;
  status: ApartmentStatus;
  ownerName: string;
  residentId?: string;
  notes?: string;
  monthlyQuota: number;
}

export interface Dependent {
  id: string;
  name: string;
  relation: "Cônjuge" | "Filho(a)" | "Pai/Mãe" | "Outro";
  birthYear?: number;
}

export interface Resident {
  id: string;
  name: string;
  email: string;
  phone: string;
  documentId: string;
  apartmentId?: string;
  type: "proprietario" | "inquilino";
  status: "activo" | "inactivo";
  since: string;
  dependents: Dependent[];
  notes?: string;
}

export type QuotaStatus = "pendente" | "em_analise" | "aprovado" | "rejeitado" | "em_atraso";

export interface Quota {
  id: string;
  apartmentId: string;
  period: string; // YYYY-MM
  description: string;
  amount: number;
  dueDate: string;
  status: QuotaStatus;
  paymentId?: string;
}

export type PaymentMethod = "transferencia" | "multicaixa" | "deposito" | "numerario";
export type PaymentStatus = "em_analise" | "aprovado" | "rejeitado";

export interface PaymentProof {
  name: string;
  type: string;
  size: number;
  /** Pré-visualização local (data URL). Não é enviado para nenhum servidor. */
  dataUrl?: string;
}

export interface Payment {
  id: string;
  quotaId: string;
  apartmentId: string;
  residentId?: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  paidAt: string;
  submittedAt: string;
  proof?: PaymentProof;
  status: PaymentStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  note?: string;
}

export type CircularStatus = "rascunho" | "publicada" | "arquivada";

export interface Circular {
  id: string;
  number: string;
  subject: string;
  body: string;
  date: string;
  status: CircularStatus;
  audience: string;
  author: string;
  authorTitle: string;
  publishedAt?: string;
  updatedAt: string;
}

export interface InternalNotice {
  id: string;
  title: string;
  body: string;
  category: PublicNotice["category"];
  date: string;
  visibility: "publico" | "moradores";
  author: string;
  pinned?: boolean;
}

export type VisitStatus = "aguardando" | "no_interior" | "saiu" | "recusado";

export interface Visitor {
  id: string;
  name: string;
  documentId: string;
  apartmentId: string;
  reason: string;
  vehiclePlate?: string;
  entryAt: string;
  exitAt?: string;
  status: VisitStatus;
  registeredBy: string;
}

export type OccurrencePriority = "baixa" | "media" | "alta";
export type OccurrenceStatus = "aberta" | "em_curso" | "resolvida";

export interface Occurrence {
  id: string;
  title: string;
  description: string;
  category: "Segurança" | "Manutenção" | "Ruído" | "Limpeza" | "Estacionamento" | "Outro";
  priority: OccurrencePriority;
  status: OccurrenceStatus;
  apartmentId?: string;
  location: string;
  createdAt: string;
  reportedBy: string;
}

export interface AccessLog {
  id: string;
  at: string;
  type: "entrada" | "saida";
  person: string;
  category: "morador" | "visitante" | "prestador" | "entrega";
  apartmentId?: string;
  gate: string;
}

export type DocumentCategory = "circular" | "regulamento" | "acta" | "comunicado" | "institucional";

export interface CondoDocument {
  id: string;
  title: string;
  description: string;
  category: DocumentCategory;
  fileType: "PDF" | "DOCX" | "XLSX" | "IMG";
  size: number;
  updatedAt: string;
  visibility: "publico" | "moradores" | "administracao";
  uploadedBy: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  roles: Role[];
  href?: string;
}
