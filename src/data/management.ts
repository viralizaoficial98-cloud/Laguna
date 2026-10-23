/**
 * DADOS DE DEMONSTRAÇÃO da área de gestão.
 *
 * - Estrutura de blocos (01 a 10) e numeração (101 a 502) segue a Circular
 *   N.º 04/ADMLR/2025, aplicada como CADASTRO PROVISÓRIO: não confirma que
 *   todos os blocos tenham exactamente estas fracções.
 * - As tipologias ficam "por definir" (null) até confirmação da Administração.
 * - Moradores, ocupação, pagamentos, visitas e ocorrências são fictícios.
 */
import type {
  AccessLog,
  Apartment,
  AppNotification,
  Circular,
  CondoDocument,
  CondoSettings,
  InternalNotice,
  Payment,
  PaymentMethod,
  Quota,
  Resident,
  Visit,
  VisitCheck,
} from "@/types";
import { parseQuarter, seededRandom } from "@/lib/utils";

export const DEMO_TODAY = "2026-10-19";
export const ADMIN_NAME = "José Leiria";
export const ADMIN_TITLE = "Administrador do Condomínio";

/** Blocos identificados na documentação da Administração. */
export const BLOCKS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"];

/** Proposta inicial de fracções por piso (provisória). */
export const PROVISIONAL_LAYOUT: { floor: number; numbers: string[] }[] = [
  { floor: 1, numbers: ["101", "102"] },
  { floor: 2, numbers: ["201", "202"] },
  { floor: 3, numbers: ["301", "302"] },
  { floor: 4, numbers: ["401", "402"] },
  { floor: 5, numbers: ["501", "502"] },
];

/** Tipologias oficiais: exclusivamente T2 e Duplex. */
export const TYPOLOGIES = ["T2", "Duplex"] as const;

/**
 * Proposta PROVISÓRIA de distribuição: 10 fracções por bloco, 8 T2 + 2 Duplex.
 * Considera-se que os Duplex correspondem às fracções 501 e 502 (piso superior) — a confirmar
 * e alterável pela Administração no cadastro de apartamentos.
 */
export const PROVISIONAL_DUPLEX_NUMBERS = ["501", "502"];

/** Configuração em vigor — editável pela Administração / Gestor Financeiro. */
export const DEFAULT_SETTINGS: CondoSettings = {
  quotaByTypology: { T2: 300_000, Duplex: 600_000 },
  dueDay: 15,
  allowPartial: true,
  reservationFee: 50_000,
  reservationHoldHours: 48,
};

export const FINANCE_NAME = "Saraiva";
export const GESTOR_OP_NAME = "Nelson Rodrigues";

export const QUOTA_PERIODS = ["2025-T4", "2026-T1", "2026-T2", "2026-T3", "2026-T4"];

export function aptId(block: string, number: string) {
  return `apt_${block}_${number}`;
}

/** Data limite: dia configurado do 1.º mês do trimestre. */
export function quotaDueDate(period: string, dueDay: number) {
  const { year, quarter } = parseQuarter(period);
  const month = (quarter - 1) * 3 + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
}

export function quotaDescription(period: string) {
  const { year, quarter } = parseQuarter(period);
  return `Quota trimestral — ${quarter}.º Trimestre ${year}`;
}

const FIRST = ["Ana", "João", "Maria", "Pedro", "Isabel", "António", "Luísa", "Manuel", "Rosa", "Francisco", "Teresa", "Carlos", "Joana", "Miguel", "Sara", "Rui", "Beatriz", "Alberto", "Fernanda", "Nelson", "Edna", "Válter", "Celeste", "Augusto", "Yolanda", "Mário", "Esperança", "Bruno", "Lurdes", "Hélder"];
const LAST = ["Domingos", "Baptista", "Fernandes", "Silva", "Neto", "Mateus", "Lopes", "Gaspar", "Cristóvão", "Tavares", "Pinto", "Sousa", "Manuel", "Costa", "Bento", "Jorge", "Vieira", "Gomes", "Simão", "Pascoal", "Miranda", "Quintas", "Lemos", "Correia"];
const METHODS: PaymentMethod[] = ["transferencia", "multicaixa", "deposito", "transferencia"];

function pick<T>(arr: T[], r: () => number) {
  return arr[Math.floor(r() * arr.length)];
}

function emailFor(name: string, i: number) {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\s+/g, ".") + (i % 3 === 0 ? i : "") + "@exemplo.demo"
  );
}

export interface ManagementSeed {
  apartments: Apartment[];
  residents: Resident[];
  quotas: Quota[];
  payments: Payment[];
}

export const DEMO_RESIDENT_APT = aptId("06", "201");
/** Fracções com moradores usados nos exemplos de visitas. */
const FORCED_OCCUPIED = new Set([DEMO_RESIDENT_APT, aptId("03", "102"), aptId("08", "401"), aptId("10", "502"), aptId("01", "101"), aptId("03", "202"), aptId("04", "302"), aptId("07", "201")]);
/** Fracção usada no exemplo de processo de desocupação. */
export const MOVEOUT_DEMO_APT = aptId("04", "302");

export function createManagementSeed(settings: CondoSettings = DEFAULT_SETTINGS): ManagementSeed {
  const r = seededRandom(2026);
  const apartments: Apartment[] = [];
  const residents: Resident[] = [];

  for (const block of BLOCKS) {
    for (const { floor, numbers } of PROVISIONAL_LAYOUT) {
      for (const number of numbers) {
        const id = aptId(block, number);
        const isDemoApt = id === DEMO_RESIDENT_APT;
        const roll = r();
        const status = FORCED_OCCUPIED.has(id) ? "ocupado" : roll < 0.86 ? "ocupado" : roll < 0.96 ? "disponivel" : "manutencao";
        const ownerName = isDemoApt ? "Manuel Muenho" : `${pick(FIRST, r)} ${pick(LAST, r)}`;
        const apt: Apartment = {
          id,
          block,
          number,
          floor,
          typology: PROVISIONAL_DUPLEX_NUMBERS.includes(number) ? "Duplex" : "T2",
          status,
          active: true,
          provisional: true,
          ownerName,
          notes: status === "manutencao" ? "Obras de manutenção interior em curso (demo)." : undefined,
        };
        if (status === "ocupado") {
          const isOwner = isDemoApt || r() < 0.7;
          const name = isDemoApt ? "Manuel Muenho" : isOwner ? ownerName : `${pick(FIRST, r)} ${pick(LAST, r)}`;
          const resId = isDemoApt ? "res_demo" : `res_${block}_${number}`;
          const depCount = isDemoApt ? 2 : Math.floor(r() * 3);
          residents.push({
            id: resId,
            name,
            email: isDemoApt ? "manuel.muenho@residenciallaguna.ao" : emailFor(name, residents.length),
            phone: `+244 9${Math.floor(10 + r() * 89)} ${Math.floor(100 + r() * 899)} ${Math.floor(100 + r() * 899)}`,
            documentId: `00${Math.floor(1000000 + r() * 8999999)}LA0${Math.floor(10 + r() * 89)}`,
            apartmentId: id,
            type: isOwner ? "proprietario" : "inquilino",
            status: isDemoApt || r() < 0.94 ? "activo" : "inactivo",
            since: `20${18 + Math.floor(r() * 8)}-0${1 + Math.floor(r() * 9)}-1${Math.floor(r() * 9)}`,
            dependents: Array.from({ length: depCount }, (_, k) => ({
              id: `dep_${resId}_${k}`,
              name: `${pick(FIRST, r)} ${name.split(" ").at(-1)}`,
              relation: k === 0 ? "Cônjuge" : "Filho(a)",
              birthYear: k === 0 ? 1980 + Math.floor(r() * 12) : 2008 + Math.floor(r() * 14),
            })),
          });
          apt.residentId = resId;
        }
        apartments.push(apt);
      }
    }
  }

  const quotas: Quota[] = [];
  const payments: Payment[] = [];

  // As quotas são devidas por TODAS as fracções activas (ocupadas ou não — o proprietário responde pela quota).
  for (const apt of apartments.filter((a) => a.active)) {
    const isDemo = apt.id === DEMO_RESIDENT_APT;
    const quotaValue = settings.quotaByTypology[apt.typology];
    QUOTA_PERIODS.forEach((period, idx) => {
      const { year, quarter } = parseQuarter(period);
      const dueDate = quotaDueDate(period, settings.dueDay);
      const quota: Quota = {
        id: `quo_${apt.id}_${period}`,
        apartmentId: apt.id,
        period,
        year,
        quarter,
        description: quotaDescription(period),
        amount: quotaValue,
        typology: apt.typology,
        paidAmount: 0,
        dueDate,
        status: "pendente",
      };
      const roll = r();
      let status: Quota["status"];
      if (isDemo) status = idx < QUOTA_PERIODS.length - 1 ? "pago" : "pendente";
      else if (apt.id === MOVEOUT_DEMO_APT && idx >= 3) status = idx === 3 ? "parcial" : "pendente";
      else if (idx <= 2) status = roll < 0.92 ? "pago" : "em_atraso";
      else if (idx === 3) status = roll < 0.84 ? "pago" : "em_atraso";
      else status = roll < 0.42 ? "pago" : roll < 0.58 ? "em_analise" : roll < 0.63 ? "parcial" : "pendente";
      // Quotas não pagas após a data limite ficam "Em atraso"
      if (status === "pendente" && dueDate < DEMO_TODAY) status = "em_atraso";
      quota.status = status;

      if (status === "pago" || status === "em_analise" || status === "parcial") {
        // pagamento entre 20 dias antes e 25 dias depois do início do trimestre (nunca depois de hoje)
        const base = new Date(`${dueDate}T10:00:00`);
        base.setDate(base.getDate() - 34 + Math.floor(r() * 45));
        const max = new Date(`${DEMO_TODAY}T09:00:00`);
        const paid = base > max ? max : base;
        const paidAt = `${paid.getFullYear()}-${String(paid.getMonth() + 1).padStart(2, "0")}-${String(paid.getDate()).padStart(2, "0")}T${String(8 + Math.floor(r() * 9)).padStart(2, "0")}:${String(Math.floor(r() * 59)).padStart(2, "0")}:00`;
        const method = pick(METHODS, r);
        const pay: Payment = {
          id: `pay_${apt.id}_${period}`,
          quotaId: quota.id,
          apartmentId: apt.id,
          residentId: apt.residentId,
          amount: status === "parcial" ? quota.amount / 2 : quota.amount,
          method,
          reference: `${method === "multicaixa" ? "MCX" : method === "deposito" ? "DEP" : "TRF"}-${Math.floor(100000 + r() * 899999)}`,
          paidAt,
          submittedAt: paidAt,
          proof: { name: `comprovativo-B${apt.block}-${apt.number}-${period}.pdf`, type: "application/pdf", size: Math.floor(80000 + r() * 400000) },
          status: status === "em_analise" ? "em_analise" : "aprovado",
          reviewedBy: status === "em_analise" ? undefined : r() < 0.75 ? FINANCE_NAME : GESTOR_OP_NAME,
          reviewedAt: status === "em_analise" ? undefined : paidAt,
          note: status === "parcial" ? "Pagamento parcial aceite (demo)." : undefined,
        };
        if (pay.reviewedBy) {
          pay.reviewedByRole = pay.reviewedBy === FINANCE_NAME ? "financeiro" : "gestor";
          pay.validatedAmount = pay.amount;
          pay.receiptNumber = `REC-${period.replace("-", "")}-${apt.block}${apt.number}`;
          quota.paidAmount = pay.amount;
        }
        payments.push(pay);
        quota.paymentId = pay.id;
      }
      quotas.push(quota);
    });
  }

  return { apartments, residents, quotas, payments };
}

// ————— Visitas (autorizadas pelos moradores) —————

const g = (id: string, name: string, phone?: string) => ({ id, name, phone });

export const seedVisits: Visit[] = [
  {
    id: "vis_1",
    kind: "individual",
    residentId: "res_demo",
    apartmentId: DEMO_RESIDENT_APT,
    date: "2026-10-19",
    time: "09:00",
    guests: [g("gst_1", "Jorge Kapitango", "+244 923 000 111")],
    notes: "Familiar — almoço.",
    status: "autorizada",
    createdAt: "2026-10-18T20:10:00",
    updatedAt: "2026-10-18T20:10:00",
  },
  {
    id: "vis_2",
    kind: "individual",
    residentId: "res_03_102",
    apartmentId: aptId("03", "102"),
    date: "2026-10-19",
    time: "10:30",
    guests: [g("gst_2", "Rita Mussungo")],
    status: "autorizada",
    createdAt: "2026-10-19T08:00:00",
    updatedAt: "2026-10-19T08:00:00",
  },
  {
    id: "vis_3",
    kind: "grupo",
    residentId: "res_demo",
    apartmentId: DEMO_RESIDENT_APT,
    date: "2026-10-25",
    time: "15:00",
    eventName: "Aniversário da Sofia",
    eventType: "Aniversário",
    notes: "Festa no apartamento. Convidados chegam a partir das 15h.",
    guests: [
      "Ana Baptista", "Pedro Neto", "Isabel Gaspar", "Miguel Tavares", "Sara Lopes", "Bruno Costa", "Celeste Pinto", "Augusto Simão",
      "Yolanda Mateus", "Nelson Vieira", "Edna Correia", "Hélder Gomes", "Lurdes Bento", "Válter Jorge", "Joana Miranda",
    ].map((n, i) => g(`gst_3_${i}`, n)),
    status: "autorizada",
    createdAt: "2026-10-17T19:00:00",
    updatedAt: "2026-10-17T19:00:00",
  },
  {
    id: "vis_4",
    kind: "grupo",
    residentId: "res_08_401",
    apartmentId: aptId("08", "401"),
    date: "2026-10-19",
    time: "18:00",
    eventName: "Reunião familiar",
    eventType: "Festa familiar",
    guests: ["Francisco Lemos", "Teresa Lemos", "Carlos Quintas", "Beatriz Quintas", "Rui Sousa", "Mário Fernandes"].map((n, i) => g(`gst_4_${i}`, n)),
    status: "autorizada",
    createdAt: "2026-10-16T12:00:00",
    updatedAt: "2026-10-16T12:00:00",
  },
  {
    id: "vis_5",
    kind: "individual",
    residentId: "res_10_502",
    apartmentId: aptId("10", "502"),
    date: "2026-10-18",
    time: "16:00",
    guests: [g("gst_5", "Eduardo Chipenda")],
    status: "autorizada",
    createdAt: "2026-10-17T09:00:00",
    updatedAt: "2026-10-17T09:00:00",
  },
  {
    id: "vis_6",
    kind: "individual",
    residentId: "res_01_101",
    apartmentId: aptId("01", "101"),
    date: "2026-10-21",
    time: "11:00",
    guests: [g("gst_6", "Lúcia Ngola")],
    status: "autorizada",
    createdAt: "2026-10-19T07:30:00",
    updatedAt: "2026-10-19T07:30:00",
  },
];

export const seedVisitChecks: VisitCheck[] = [
  { id: "chk_1", visitId: "vis_1", guestId: "gst_1", type: "entrada", at: "2026-10-19T09:12:00", by: "Portaria" },
  { id: "chk_2", visitId: "vis_5", guestId: "gst_5", type: "entrada", at: "2026-10-18T16:05:00", by: "Portaria" },
  { id: "chk_3", visitId: "vis_5", guestId: "gst_5", type: "saida", at: "2026-10-18T18:40:00", by: "Portaria" },
];

export const seedAccessLogs: AccessLog[] = (() => {
  const r = seededRandom(77);
  const people = ["Manuel Muenho", "Nelson Pinto", "Edna Gaspar", "Rui Tavares", "Jorge Kapitango", "Técnico de manutenção", "Entrega — Encomenda", "Sara Lopes", "Hélder Costa", "Fernanda Neto"];
  const cats: AccessLog["category"][] = ["morador", "morador", "morador", "morador", "visitante", "prestador", "entrega", "morador", "morador", "morador"];
  return Array.from({ length: 36 }, (_, i) => {
    const pi = Math.floor(r() * people.length);
    const day = 19 - Math.floor(i / 9);
    const hour = 23 - ((i * 2) % 16);
    const pl = pick(PROVISIONAL_LAYOUT, r);
    return {
      id: `acc_${i}`,
      at: `2026-10-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(Math.floor(r() * 59)).padStart(2, "0")}:00`,
      type: r() < 0.55 ? "entrada" : "saida",
      person: people[pi],
      category: cats[pi],
      apartmentId: aptId(pick(BLOCKS, r), pick(pl.numbers, r)),
      gate: "Entrada principal",
    } satisfies AccessLog;
  }).sort((a, b) => b.at.localeCompare(a.at));
})();


const ALL_RECIPIENTS = { mode: "todos" as const, blocks: {}, listInBody: false };

/** Circulares de EXEMPLO (conteúdo de demonstração). */
export const seedCirculars: Circular[] = [
  {
    id: "cir_1",
    sequence: 1,
    year: 2026,
    number: "01/ADMLR/2026",
    subject: "Plano de Manutenção Preventiva das Áreas Comuns",
    body: "Informa-se a todos os condóminos que, durante o 1.º trimestre de 2026, será executado o plano de manutenção preventiva das áreas comuns, incluindo piscinas, iluminação exterior e espaços verdes.\n\nAs intervenções serão comunicadas com antecedência, procurando minimizar o impacto no dia-a-dia dos moradores.\n\n(Circular de exemplo — conteúdo de demonstração.)",
    date: "2026-01-12",
    status: "arquivada",
    recipients: ALL_RECIPIENTS,
    author: ADMIN_NAME,
    authorTitle: ADMIN_TITLE,
    publishedAt: "2026-01-12T10:00:00",
    updatedAt: "2026-04-01T10:00:00",
  },
  {
    id: "cir_2",
    sequence: 2,
    year: 2026,
    number: "02/ADMLR/2026",
    subject: "Regras de Utilização das Piscinas",
    body: "Recordam-se as regras de utilização das piscinas: respeito pelo horário de funcionamento, duche prévio obrigatório e acompanhamento de menores por um adulto responsável.\n\nO cumprimento destas regras garante a segurança e o bem-estar de todos.\n\n(Circular de exemplo — conteúdo de demonstração.)",
    date: "2026-09-28",
    status: "publicada",
    recipients: ALL_RECIPIENTS,
    author: ADMIN_NAME,
    authorTitle: ADMIN_TITLE,
    publishedAt: "2026-09-28T09:00:00",
    updatedAt: "2026-09-28T09:00:00",
  },
  {
    id: "cir_3",
    sequence: 3,
    year: 2026,
    number: "03/ADMLR/2026",
    subject: "Pagamento da Quota do 4.º Trimestre de 2026",
    body: "Recorda-se a todos os condóminos que o pagamento da quota do condomínio referente ao 4.º trimestre de 2026 (Outubro a Dezembro) deverá ser efectuado dentro do prazo estabelecido.\n\nOs comprovativos podem ser enviados através da Área de Moradores do portal.\n\n(Circular de exemplo — conteúdo de demonstração.)",
    date: "2026-10-01",
    status: "publicada",
    recipients: ALL_RECIPIENTS,
    author: ADMIN_NAME,
    authorTitle: ADMIN_TITLE,
    publishedAt: "2026-10-01T09:00:00",
    updatedAt: "2026-10-01T09:00:00",
  },
  {
    id: "cir_4",
    sequence: 4,
    year: 2026,
    number: "04/ADMLR/2026",
    subject: "Intervenção na Rede de Água",
    body: "Informa-se que será efectuada uma intervenção técnica na rede de abastecimento de água, com interrupção temporária do fornecimento aos apartamentos abaixo mencionados:",
    closing: "Agradecemos a compreensão de todos.\n\n(Rascunho de exemplo — conteúdo de demonstração.)",
    date: "2026-10-19",
    status: "rascunho",
    recipients: { mode: "seleccao", blocks: { "03": ["101", "102", "201"], "06": [] }, listInBody: true },
    author: ADMIN_NAME,
    authorTitle: ADMIN_TITLE,
    updatedAt: "2026-10-19T08:00:00",
  },
];

export const seedNotices: InternalNotice[] = [
  { id: "not_1", title: "Manutenção preventiva das piscinas", body: "As piscinas estarão encerradas para limpeza e tratamento da água. (Comunicado de demonstração)", category: "Manutenção", date: "2026-10-14", visibility: "publico", status: "publicado", author: ADMIN_NAME, pinned: true, publishedAt: "2026-10-14T09:00:00", updatedAt: "2026-10-14T09:00:00" },
  { id: "not_2", title: "Convocatória para Assembleia Geral", body: "A ordem de trabalhos completa está disponível na secção de documentos. (Comunicado de demonstração)", category: "Assembleia", date: "2026-10-06", visibility: "publico", status: "publicado", author: ADMIN_NAME, publishedAt: "2026-10-06T09:00:00", updatedAt: "2026-10-06T09:00:00" },
  { id: "not_3", title: "Registo prévio de visitas", body: "As visitas devem ser registadas pelos moradores na Área de Moradores; a Portaria confirma a entrada com base nessa autorização. (Comunicado de demonstração)", category: "Segurança", date: "2026-09-25", visibility: "moradores", status: "publicado", author: ADMIN_NAME, publishedAt: "2026-09-25T09:00:00", updatedAt: "2026-09-25T09:00:00" },
  { id: "not_4", title: "Corte programado de água — Bloco 03", body: "Interrupção do abastecimento entre as 09h e as 12h para intervenção técnica. (Comunicado de demonstração)", category: "Manutenção", date: "2026-08-16", visibility: "moradores", status: "retirado", author: ADMIN_NAME, publishedAt: "2026-08-16T09:00:00", withdrawnAt: "2026-08-20T09:00:00", updatedAt: "2026-08-20T09:00:00" },
];

export const seedDocuments: CondoDocument[] = [
  { id: "doc_1", title: "Regulamento Interno do Condomínio", description: "Regras de convivência, utilização das áreas comuns e deveres dos moradores.", category: "regulamento", fileType: "PDF", size: 1_240_000, updatedAt: "2026-03-15", visibility: "moradores", uploadedBy: ADMIN_NAME },
  { id: "doc_2", title: "Regulamento de Utilização das Piscinas", description: "Horários, normas de segurança e higiene.", category: "regulamento", fileType: "PDF", size: 420_000, updatedAt: "2026-09-28", visibility: "moradores", uploadedBy: ADMIN_NAME },
  { id: "doc_3", title: "Acta da Assembleia Geral — Março 2026", description: "Deliberações da assembleia ordinária (demo).", category: "acta", fileType: "PDF", size: 860_000, updatedAt: "2026-03-30", visibility: "moradores", uploadedBy: ADMIN_NAME },
  { id: "doc_5", title: "Circular 03/ADMLR/2026 — Quota do 4.º trimestre", description: "Pagamento da quota trimestral (exemplo).", category: "circular", fileType: "PDF", size: 210_000, updatedAt: "2026-10-01", visibility: "moradores", uploadedBy: ADMIN_NAME },
  { id: "doc_6", title: "Circular 02/ADMLR/2026 — Regras das piscinas", description: "Normas de utilização das piscinas (exemplo).", category: "circular", fileType: "PDF", size: 190_000, updatedAt: "2026-09-28", visibility: "moradores", uploadedBy: ADMIN_NAME },
  { id: "doc_8", title: "Apresentação institucional do Residencial Laguna", description: "Documento de apresentação do condomínio.", category: "institucional", fileType: "PDF", size: 3_400_000, updatedAt: "2026-01-10", visibility: "publico", uploadedBy: ADMIN_NAME },
  { id: "doc_9", title: "Orçamento anual 2026", description: "Orçamento aprovado em assembleia (demo).", category: "institucional", fileType: "XLSX", size: 96_000, updatedAt: "2026-03-30", visibility: "administracao", uploadedBy: "Gestão Financeira" },
];

export const seedNotifications: AppNotification[] = [
  { id: "ntf_1", title: "Novo comprovativo submetido", body: "Bloco 03 · 202 enviou comprovativo da quota do 4.º trimestre.", at: "2026-10-19T09:20:00", read: false, roles: ["administrador"], href: "/painel/pagamentos" },
  { id: "ntf_2", title: "Elevador avariado — Bloco 09", body: "Avaria registada por Nelson Rodrigues; intervenção em curso.", at: "2026-10-20T08:15:00", read: false, roles: ["administrador", "gestor"], href: "/painel/elevadores" },
  { id: "ntf_8", title: "Nova ocorrência de morador", body: "Bloco 06 · 201 — lâmpada fundida no hall do 2.º piso.", at: "2026-10-18T07:45:00", read: false, roles: ["gestor"], href: "/painel/ocorrencias" },
  { id: "ntf_3", title: "Circular em rascunho", body: "A circular 04/ADMLR/2026 aguarda publicação.", at: "2026-10-19T08:05:00", read: true, roles: ["administrador"], href: "/painel/circulares" },
  { id: "ntf_4", title: "Visita de grupo autorizada", body: "Aniversário — Bloco 06 · 201, 25/10/2026 (15 convidados).", at: "2026-10-17T19:00:00", read: false, roles: ["porteiro"], href: "/painel/portaria" },
  { id: "ntf_5", title: "Quota do 4.º trimestre disponível", body: "Quota trimestral de Outubro a Dezembro de 2026.", at: "2026-10-01T08:00:00", read: false, roles: ["morador"], href: "/painel/minhas-quotas" },
  { id: "ntf_6", title: "Nova circular publicada", body: "Circular 03/ADMLR/2026 — Pagamento da quota do 4.º trimestre.", at: "2026-10-01T09:00:00", read: true, roles: ["morador"], href: "/painel/circulares" },
  { id: "ntf_7", title: "Entrada confirmada", body: "Jorge Kapitango deu entrada às 09:12.", at: "2026-10-19T09:12:00", read: false, roles: ["morador"], href: "/painel/visitas" },
];
