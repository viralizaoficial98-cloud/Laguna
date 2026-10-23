/**
 * Modelos de domínio do Portal Residencial Laguna.
 * Estes tipos espelham o futuro esquema de base de dados (MySQL + Prisma),
 * pelo que os nomes e relações (ids) devem manter-se estáveis.
 */

/** Perfis de acesso: Administrador do Condomínio, Gestor Operacional, Gestor Financeiro, Morador e Portaria. */
export type Role = "administrador" | "gestor" | "financeiro" | "morador" | "porteiro";

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
/** Tipologias oficiais do Residencial Laguna: exclusivamente T2 e Duplex (3 quartos, sala, varanda). */
export type TypologyCode = "T2" | "Duplex";

export interface Apartment {
  id: string;
  /** Bloco "01" a "10". */
  block: string;
  number: string;
  floor: number;
  typology: TypologyCode;
  status: ApartmentStatus;
  /** false = fracção desactivada (inexistente ou fora de uso). */
  active: boolean;
  /** true = cadastro provisório, sujeito a validação da Administração. */
  provisional: boolean;
  ownerName: string;
  residentId?: string;
  notes?: string;
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

/** em_analise = "Em Validação"; parcial = "Parcialmente Pago". */
export type QuotaStatus = "pendente" | "em_analise" | "pago" | "parcial" | "em_atraso";

/** Quota TRIMESTRAL do condomínio. */
export interface Quota {
  id: string;
  apartmentId: string;
  /** Período trimestral no formato "2026-T4". */
  period: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  description: string;
  amount: number;
  dueDate: string;
  status: QuotaStatus;
  /** Tipologia usada no cálculo (T2 = 300 000 Kz; Duplex = 600 000 Kz). */
  typology: TypologyCode;
  /** Soma dos pagamentos aprovados. */
  paidAmount: number;
  /** Último pagamento submetido. */
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
  /** Referência da transacção — OPCIONAL (pode ser vazia). */
  reference: string;
  paidAt: string;
  submittedAt: string;
  proof?: PaymentProof;
  status: PaymentStatus;
  reviewedBy?: string;
  reviewedByRole?: Role;
  reviewedAt?: string;
  note?: string;
  /** Valor efectivamente validado (pode ser inferior ao valor submetido — pagamento parcial). */
  validatedAmount?: number;
  /** Registado directamente pelo Gestor Financeiro (ex.: numerário), sem comprovativo do morador. */
  registeredBy?: string;
  /** N.º do recibo emitido após confirmação. */
  receiptNumber?: string;
}

export type CircularStatus = "rascunho" | "publicada" | "arquivada";

export interface CircularRecipients {
  /** "todos" = todos os moradores; "seleccao" = blocos/apartamentos escolhidos. */
  mode: "todos" | "seleccao";
  /** Mapa bloco → números de apartamento (lista vazia = bloco inteiro). */
  blocks: Record<string, string[]>;
  /** Apresentar a lista de blocos/apartamentos no corpo da circular. */
  listInBody: boolean;
}

export interface Circular {
  id: string;
  /** Sequência anual (1, 2, 3…). */
  sequence: number;
  year: number;
  /** Referência oficial, ex.: "04/ADMLR/2026". */
  number: string;
  subject: string;
  body: string;
  /** Texto opcional após a lista de destinatários. */
  closing?: string;
  date: string;
  status: CircularStatus;
  recipients: CircularRecipients;
  author: string;
  authorTitle: string;
  publishedAt?: string;
  updatedAt: string;
}

export interface NoticeAttachment {
  name: string;
  size: number;
  /** PDF em data URL — apenas em memória/localStorage do browser nesta fase. */
  dataUrl?: string;
}

export type NoticeStatus = "rascunho" | "publicado" | "retirado";

export interface InternalNotice {
  id: string;
  title: string;
  /** Descrição / resumo do comunicado. */
  body: string;
  category: PublicNotice["category"];
  date: string;
  visibility: "publico" | "moradores";
  status: NoticeStatus;
  author: string;
  pinned?: boolean;
  pdf?: NoticeAttachment;
  publishedAt?: string;
  withdrawnAt?: string;
  updatedAt: string;
}

export interface Guest {
  id: string;
  name: string;
  phone?: string;
}

/**
 * Autorização de visita criada pelo MORADOR.
 * A Portaria apenas consulta e confirma entradas/saídas (ver VisitCheck);
 * a autorização original nunca é alterada pela Portaria.
 */
export interface Visit {
  id: string;
  kind: "individual" | "grupo";
  residentId: string;
  apartmentId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (horário previsto)
  notes?: string;
  /** Visita individual: o visitante. Grupo: lista de convidados. */
  guests: Guest[];
  eventName?: string;
  eventType?: "Aniversário" | "Festa familiar" | "Reunião" | "Outro evento";
  status: "autorizada" | "cancelada";
  createdAt: string;
  updatedAt: string;
}

/** Registo de entrada/saída confirmado pela Portaria (histórico imutável). */
export interface VisitCheck {
  id: string;
  visitId: string;
  guestId: string;
  type: "entrada" | "saida";
  at: string;
  by: string;
}

export type GuestPresence = "aguardando" | "no_interior" | "saiu";

export interface CondoSettings {
  /** Quota trimestral por tipologia (Kz). */
  quotaByTypology: Record<TypologyCode, number>;
  /** Dia limite de pagamento no 1.º mês de cada trimestre. */
  dueDay: number;
  /** Aceitar pagamentos parciais das quotas. */
  allowPartial: boolean;
  /** Valor da reserva de salão (Kz). */
  reservationFee: number;
  /** Prazo (horas) para pagar uma reserva provisória antes de expirar. */
  reservationHoldHours: number;
}

// ————— Reservas de salões —————

export interface Hall {
  id: string;
  name: string;
  description?: string;
  capacity?: number;
  active: boolean;
  /** true = salão de demonstração, a confirmar pela Administração. */
  demo: boolean;
}

export type ReservationStatus = "em_espera" | "pendente_pagamento" | "em_validacao" | "confirmada" | "cancelada" | "expirada";

export interface ReservationEvent {
  id: string;
  at: string;
  by: string;
  text: string;
  status?: ReservationStatus;
}

export interface Reservation {
  id: string;
  hallId: string;
  residentId: string;
  apartmentId: string;
  date: string;
  startTime: string;
  endTime: string;
  eventType: string;
  eventName: string;
  expectedGuests: number;
  guests: Guest[];
  notes?: string;
  fee: number;
  status: ReservationStatus;
  createdAt: string;
  /** Prazo do bloqueio provisório (pendente de pagamento). */
  expiresAt?: string;
  payment?: {
    reference: string;
    proof?: PaymentProof;
    submittedAt: string;
    reviewedBy?: string;
    reviewedAt?: string;
    note?: string;
    receiptNumber?: string;
  };
  history: ReservationEvent[];
}

// ————— Encargos, ocupações, desocupação e auditoria —————

/** Encargo adicional (ex.: danos). Só conta como dívida depois de confirmado pela Administração. */
export interface Charge {
  id: string;
  apartmentId: string;
  description: string;
  justification: string;
  amount: number;
  date: string;
  status: "proposto" | "confirmado" | "pago" | "anulado";
  proposedBy: string;
  confirmedBy?: string;
  moveOutId?: string;
}

/** Período de ocupação de uma fracção por um morador (histórico preservado). */
export interface Occupancy {
  id: string;
  apartmentId: string;
  residentId: string;
  residentName: string;
  from: string;
  to?: string;
}

export type MoveOutStatus =
  | "solicitacao_recebida"
  | "em_verificacao_financeira"
  | "em_verificacao_operacional"
  | "regularizacao_pendente"
  | "aguardando_aprovacao"
  | "autorizada"
  | "concluida"
  | "cancelada";

export type CheckState = "pendente" | "conforme" | "com_pendencias" | "nao_aplicavel";

export interface MoveOut {
  id: string;
  reference: string;
  residentId: string;
  residentName: string;
  apartmentId: string;
  block: string;
  number: string;
  typology: TypologyCode;
  plannedDate: string;
  reason?: string;
  contact: string;
  notes?: string;
  status: MoveOutStatus;
  createdAt: string;
  financial: { status: "pendente" | "regularizacao_pendente" | "regularizada"; by?: string; at?: string; notes?: string; debtAtCheck?: number };
  operational: {
    status: "pendente" | "concluida";
    checklist: Record<"apartamento" | "ocorrencias" | "equipamentos" | "chaves" | "danos" | "outras", { state: CheckState; notes?: string }>;
    report?: { name: string; dataUrl?: string };
    by?: string;
    at?: string;
    notes?: string;
  };
  authorization?: { by: string; role: Role; at: string; notes?: string };
  completedAt?: string;
  history: { id: string; at: string; by: string; text: string; status?: MoveOutStatus }[];
}

export interface AuditEntry {
  id: string;
  at: string;
  by: string;
  role: Role;
  action: string;
  entity: string;
  entityId: string;
  details?: string;
}

export type OccurrencePriority = "baixa" | "media" | "alta" | "urgente";
export type OccurrenceStatus = "aberta" | "em_analise" | "em_execucao" | "resolvida";
export type OccurrenceCategory =
  | "Elevadores"
  | "Electricidade"
  | "Água"
  | "Canalização"
  | "Limpeza"
  | "Jardinagem"
  | "Segurança"
  | "Infraestruturas"
  | "Outras";

export interface OccurrenceEvent {
  id: string;
  at: string;
  by: string;
  role: Role;
  text: string;
  status?: OccurrenceStatus;
}

export interface Occurrence {
  id: string;
  title: string;
  description: string;
  category: OccurrenceCategory;
  priority: OccurrencePriority;
  status: OccurrenceStatus;
  /** Bloco "01"–"10" ou ausente para áreas comuns gerais. */
  block?: string;
  apartmentId?: string;
  location: string;
  assignee?: string;
  elevatorId?: string;
  /** Morador que submeteu a ocorrência (quando aplicável). */
  residentId?: string;
  photos?: { name: string; dataUrl?: string }[];
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
  reportedBy: string;
  history: OccurrenceEvent[];
}

// ————— Operações: elevadores, limpeza, jardinagem e manutenção —————

export type ElevatorStatus = "operacional" | "avariado" | "em_manutencao" | "fora_servico";

export interface ElevatorEvent {
  id: string;
  at: string;
  by: string;
  type: "avaria" | "intervencao" | "manutencao" | "estado";
  description: string;
  status: ElevatorStatus;
}

export interface Elevator {
  id: string;
  block: string;
  code: string;
  status: ElevatorStatus;
  lastMaintenance?: string;
  nextMaintenance?: string;
  provider: string;
  notes?: string;
  /** true = registo de demonstração; o inventário real deve ser configurado. */
  demo: boolean;
  history: ElevatorEvent[];
}

export type OpsArea = "limpeza" | "jardinagem" | "manutencao";
export type OpsStatus = "programada" | "em_execucao" | "concluida";

export interface OpsInspection {
  result: "conforme" | "nao_conforme";
  notes?: string;
  by: string;
  at: string;
}

/** Actividade operacional (plano de limpeza, jardinagem ou manutenção). */
export interface OpsTask {
  id: string;
  area: OpsArea;
  /** Limpeza: tipo de serviço · Jardinagem: Rega/Poda/… · Manutenção: Preventiva/Correctiva */
  type: string;
  title: string;
  location: string;
  block?: string;
  responsible: string;
  frequency?: "Diária" | "Semanal" | "Quinzenal" | "Mensal" | "Trimestral" | "Pontual";
  scheduledDate: string;
  dueDate?: string;
  executedDate?: string;
  status: OpsStatus;
  equipment?: string;
  estimatedCost?: number;
  actualCost?: number;
  inspection?: OpsInspection;
  notes?: string;
}

export type ExpenseCategory = "Limpeza" | "Jardinagem" | "Manutenção" | "Elevadores" | "Segurança e portaria" | "Energia e água" | "Administração";

/** Despesa do condomínio (contratos e serviços). Os custos de manutenção concluída vêm das actividades. */
export interface Expense {
  id: string;
  date: string;
  period: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
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
