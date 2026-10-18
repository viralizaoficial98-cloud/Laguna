/**
 * DADOS DE DEMONSTRAÇÃO da área de gestão.
 * Todos os nomes, apartamentos, valores e registos são fictícios e servem
 * apenas para testar a interface. Não representam informação real do condomínio.
 */
import type {
  AccessLog,
  Apartment,
  AppNotification,
  Circular,
  CondoDocument,
  InternalNotice,
  Occurrence,
  Payment,
  PaymentMethod,
  Quota,
  Resident,
  TypologyCode,
  Visitor,
} from "@/types";
import { seededRandom } from "@/lib/utils";

export const DEMO_TODAY = "2026-10-18";

export const DEMO_BLOCKS = ["A", "B", "C"];
export const QUOTA_BY_TYPOLOGY: Record<TypologyCode, number> = {
  T1: 35000,
  T2: 45000,
  T3: 60000,
  T4: 75000,
};
export const QUOTA_PERIODS = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];

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

export function createManagementSeed(): ManagementSeed {
  const r = seededRandom(2026);
  const apartments: Apartment[] = [];
  const residents: Resident[] = [];

  for (const block of DEMO_BLOCKS) {
    for (let floor = 1; floor <= 6; floor++) {
      for (let pos = 1; pos <= 4; pos++) {
        const number = `${floor}0${pos}`;
        const id = `apt_${block}${number}`;
        const typology: TypologyCode = pos === 1 || pos === 4 ? "T3" : "T2";
        const roll = r();
        const isDemoApt = block === "B" && number === "302";
        const status = isDemoApt ? "ocupado" : roll < 0.84 ? "ocupado" : roll < 0.95 ? "disponivel" : "manutencao";
        const ownerName = `${pick(FIRST, r)} ${pick(LAST, r)}`;
        const apt: Apartment = {
          id,
          block,
          number,
          floor,
          typology,
          status,
          ownerName,
          monthlyQuota: QUOTA_BY_TYPOLOGY[typology],
          notes: status === "manutencao" ? "Obras de manutenção interior em curso (demo)." : undefined,
        };
        if (status === "ocupado") {
          const isOwner = r() < 0.7;
          const name = isDemoApt ? "Carla Mendes" : isOwner ? ownerName : `${pick(FIRST, r)} ${pick(LAST, r)}`;
          const resId = isDemoApt ? "res_demo" : `res_${block}${number}`;
          const depCount = Math.floor(r() * 3);
          residents.push({
            id: resId,
            name,
            email: isDemoApt ? "morador@laguna.demo" : emailFor(name, residents.length),
            phone: `+244 9${Math.floor(10 + r() * 89)} ${Math.floor(100 + r() * 899)} ${Math.floor(100 + r() * 899)}`,
            documentId: `00${Math.floor(1000000 + r() * 8999999)}LA0${Math.floor(10 + r() * 89)}`,
            apartmentId: id,
            type: isDemoApt ? "proprietario" : isOwner ? "proprietario" : "inquilino",
            status: r() < 0.94 ? "activo" : "inactivo",
            since: `20${18 + Math.floor(r() * 8)}-0${1 + Math.floor(r() * 9)}-1${Math.floor(r() * 9)}`,
            dependents: Array.from({ length: isDemoApt ? 2 : depCount }, (_, k) => ({
              id: `dep_${resId}_${k}`,
              name: `${pick(FIRST, r)} ${name.split(" ").at(-1)}`,
              relation: k === 0 ? "Cônjuge" : "Filho(a)",
              birthYear: k === 0 ? 1980 + Math.floor(r() * 12) : 2008 + Math.floor(r() * 14),
            })),
          });
          apt.residentId = resId;
          if (isDemoApt) apt.ownerName = "Carla Mendes";
        }
        apartments.push(apt);
      }
    }
  }

  const quotas: Quota[] = [];
  const payments: Payment[] = [];
  const occupied = apartments.filter((a) => a.status === "ocupado");

  for (const apt of occupied) {
    const isDemo = apt.residentId === "res_demo";
    QUOTA_PERIODS.forEach((period, idx) => {
      const id = `quo_${apt.id}_${period}`;
      const quota: Quota = {
        id,
        apartmentId: apt.id,
        period,
        description: "Quota mensal de condomínio",
        amount: apt.monthlyQuota,
        dueDate: `${period}-25`,
        status: "pendente",
      };
      const roll = r();
      let status: Quota["status"];
      if (isDemo) {
        status = idx <= 4 ? "aprovado" : "pendente";
      } else if (idx <= 3) {
        status = roll < 0.9 ? "aprovado" : "em_atraso";
      } else if (idx === 4) {
        status = roll < 0.78 ? "aprovado" : roll < 0.88 ? "em_analise" : "em_atraso";
      } else if (idx === 5) {
        status = roll < 0.45 ? "aprovado" : roll < 0.62 ? "em_analise" : roll < 0.67 ? "rejeitado" : "pendente";
      } else {
        status = roll < 0.06 ? "em_analise" : "pendente";
      }
      quota.status = status;

      if (status === "aprovado" || status === "em_analise" || status === "rejeitado") {
        // pagamentos antecipados de quotas futuras ficam datados no mês corrente (nunca depois de hoje)
        const [y, m] = (period > DEMO_TODAY.slice(0, 7) ? DEMO_TODAY.slice(0, 7) : period).split("-").map(Number);
        const isCurrentMonth = `${y}-${String(m).padStart(2, "0")}` === DEMO_TODAY.slice(0, 7);
        const day = isCurrentMonth ? 1 + Math.floor(r() * 17) : 5 + Math.floor(r() * 18);
        const paidAt = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(8 + Math.floor(r() * 10)).padStart(2, "0")}:${String(Math.floor(r() * 59)).padStart(2, "0")}:00`;
        const method = pick(METHODS, r);
        const pay: Payment = {
          id: `pay_${apt.id}_${period}`,
          quotaId: id,
          apartmentId: apt.id,
          residentId: apt.residentId,
          amount: apt.monthlyQuota,
          method,
          reference: `${method === "multicaixa" ? "MCX" : method === "deposito" ? "DEP" : "TRF"}-${Math.floor(100000 + r() * 899999)}`,
          paidAt,
          submittedAt: paidAt,
          proof: { name: `comprovativo-${apt.block}${apt.number}-${period}.pdf`, type: "application/pdf", size: Math.floor(80000 + r() * 400000) },
          status: status === "aprovado" ? "aprovado" : status === "rejeitado" ? "rejeitado" : "em_analise",
          reviewedBy: status === "em_analise" ? undefined : "Marta Neto",
          reviewedAt: status === "em_analise" ? undefined : paidAt,
          note: status === "rejeitado" ? "Comprovativo ilegível. Por favor, envie novamente." : undefined,
        };
        payments.push(pay);
        quota.paymentId = pay.id;
      }
      quotas.push(quota);
    });
  }

  return { apartments, residents, quotas, payments };
}

function aptId(block: string, number: string) {
  return `apt_${block}${number}`;
}

export const seedVisitors: Visitor[] = [
  { id: "vis_1", name: "Jorge Kapitango", documentId: "004512398LA041", apartmentId: aptId("B", "302"), reason: "Visita familiar", entryAt: "2026-10-18T09:15:00", status: "no_interior", registeredBy: "Domingos Kiala" },
  { id: "vis_2", name: "Técnico — Assistência AC", documentId: "002398112LA032", apartmentId: aptId("A", "204"), reason: "Prestação de serviço", vehiclePlate: "LD-45-21-AB", entryAt: "2026-10-18T08:40:00", status: "no_interior", registeredBy: "Domingos Kiala" },
  { id: "vis_3", name: "Entrega — Encomenda", documentId: "—", apartmentId: aptId("C", "501"), reason: "Entrega", entryAt: "2026-10-18T10:05:00", exitAt: "2026-10-18T10:12:00", status: "saiu", registeredBy: "Domingos Kiala" },
  { id: "vis_4", name: "Rita Mussungo", documentId: "005671234LA019", apartmentId: aptId("A", "103"), reason: "Visita pessoal", entryAt: "2026-10-18T10:30:00", status: "aguardando", registeredBy: "Domingos Kiala" },
  { id: "vis_5", name: "Eduardo Chipenda", documentId: "001234987LA011", apartmentId: aptId("C", "202"), reason: "Reunião", entryAt: "2026-10-17T16:20:00", exitAt: "2026-10-17T18:02:00", status: "saiu", registeredBy: "Domingos Kiala" },
  { id: "vis_6", name: "Canalizador — Obras B", documentId: "007712311LA050", apartmentId: aptId("B", "601"), reason: "Manutenção", vehiclePlate: "LD-12-88-CF", entryAt: "2026-10-17T09:00:00", exitAt: "2026-10-17T13:45:00", status: "saiu", registeredBy: "Domingos Kiala" },
  { id: "vis_7", name: "Desconhecido (sem identificação)", documentId: "—", apartmentId: aptId("A", "402"), reason: "Não indicou", entryAt: "2026-10-17T21:10:00", status: "recusado", registeredBy: "Turno da noite" },
  { id: "vis_8", name: "Lúcia Ngola", documentId: "003398765LA027", apartmentId: aptId("B", "104"), reason: "Visita familiar", entryAt: "2026-10-16T15:00:00", exitAt: "2026-10-16T19:30:00", status: "saiu", registeredBy: "Domingos Kiala" },
  { id: "vis_9", name: "Entrega — Supermercado", documentId: "—", apartmentId: aptId("C", "603"), reason: "Entrega", entryAt: "2026-10-16T11:22:00", exitAt: "2026-10-16T11:30:00", status: "saiu", registeredBy: "Domingos Kiala" },
  { id: "vis_10", name: "Simão Capemba", documentId: "006645123LA033", apartmentId: aptId("A", "301"), reason: "Visita pessoal", entryAt: "2026-10-15T18:40:00", exitAt: "2026-10-15T22:10:00", status: "saiu", registeredBy: "Turno da noite" },
];

export const seedAccessLogs: AccessLog[] = (() => {
  const r = seededRandom(77);
  const people = ["Carla Mendes", "Nelson Pinto", "Edna Gaspar", "Rui Tavares", "Jorge Kapitango", "Técnico — Assistência AC", "Entrega — Encomenda", "Sara Lopes", "Hélder Costa", "Fernanda Neto"];
  const cats: AccessLog["category"][] = ["morador", "morador", "morador", "morador", "visitante", "prestador", "entrega", "morador", "morador", "morador"];
  const blocks = ["A", "B", "C"];
  return Array.from({ length: 36 }, (_, i) => {
    const pi = Math.floor(r() * people.length);
    const day = 18 - Math.floor(i / 9);
    const hour = 23 - ((i * 2) % 16);
    return {
      id: `acc_${i}`,
      at: `2026-10-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(Math.floor(r() * 59)).padStart(2, "0")}:00`,
      type: r() < 0.55 ? "entrada" : "saida",
      person: people[pi],
      category: cats[pi],
      apartmentId: aptId(pick(blocks, r), `${1 + Math.floor(r() * 6)}0${1 + Math.floor(r() * 4)}`),
      gate: "Entrada principal",
    } satisfies AccessLog;
  }).sort((a, b) => b.at.localeCompare(a.at));
})();

export const seedOccurrences: Occurrence[] = [
  { id: "oc_1", title: "Lâmpada fundida no hall do Bloco B", description: "Iluminação do hall do 3.º piso sem funcionar.", category: "Manutenção", priority: "media", status: "aberta", location: "Bloco B — 3.º piso", createdAt: "2026-10-18T07:45:00", reportedBy: "Carla Mendes", apartmentId: aptId("B", "302") },
  { id: "oc_2", title: "Ruído excessivo após as 22h", description: "Música alta reportada por vizinhos.", category: "Ruído", priority: "baixa", status: "resolvida", location: "Bloco A — 5.º piso", createdAt: "2026-10-17T22:30:00", reportedBy: "Turno da noite", apartmentId: aptId("A", "502") },
  { id: "oc_3", title: "Viatura estacionada em local indevido", description: "Viatura a obstruir a saída de emergência.", category: "Estacionamento", priority: "alta", status: "em_curso", location: "Entrada principal", createdAt: "2026-10-17T14:10:00", reportedBy: "Domingos Kiala" },
  { id: "oc_4", title: "Fuga de água junto à piscina", description: "Pequena fuga junto ao sistema de filtragem.", category: "Manutenção", priority: "alta", status: "em_curso", location: "Zona da piscina", createdAt: "2026-10-16T10:00:00", reportedBy: "Paulo Sebastião" },
  { id: "oc_5", title: "Tentativa de acesso sem identificação", description: "Indivíduo recusou identificar-se na entrada.", category: "Segurança", priority: "alta", status: "resolvida", location: "Entrada principal", createdAt: "2026-10-15T21:10:00", reportedBy: "Turno da noite" },
  { id: "oc_6", title: "Recolha de resíduos atrasada", description: "Contentores cheios no Bloco C.", category: "Limpeza", priority: "media", status: "aberta", location: "Bloco C — exterior", createdAt: "2026-10-15T09:30:00", reportedBy: "Domingos Kiala" },
  { id: "oc_7", title: "Elevador com ruído anormal", description: "Elevador do Bloco A emite ruído ao parar.", category: "Manutenção", priority: "media", status: "resolvida", location: "Bloco A — elevador", createdAt: "2026-10-12T12:00:00", reportedBy: "Paulo Sebastião" },
];

export const seedCirculars: Circular[] = [
  { id: "cir_1", number: "012/2026", subject: "Plano de manutenção preventiva — 4.º trimestre", body: "Exmos. Senhores Condóminos e Moradores,\n\nVimos por este meio informar que, durante o 4.º trimestre de 2026, será executado o plano de manutenção preventiva das áreas comuns, incluindo piscinas, iluminação exterior e espaços verdes.\n\nAs intervenções serão comunicadas com antecedência e procurarão minimizar o impacto no dia-a-dia dos moradores.\n\nAgradecemos desde já a vossa compreensão e colaboração.\n\nCom os melhores cumprimentos,", date: "2026-10-10", status: "publicada", audience: "Todos os moradores", author: "Paulo Sebastião", authorTitle: "Administrador do Condomínio", publishedAt: "2026-10-10T10:00:00", updatedAt: "2026-10-10T10:00:00" },
  { id: "cir_2", number: "011/2026", subject: "Regras de utilização das piscinas", body: "Exmos. Senhores Moradores,\n\nRecordamos as regras de utilização das piscinas: horário de funcionamento, obrigatoriedade de duche prévio e acompanhamento de menores por um adulto responsável.\n\nO cumprimento destas regras garante a segurança e o bem-estar de todos.\n\nCom os melhores cumprimentos,", date: "2026-09-28", status: "publicada", audience: "Todos os moradores", author: "Helena Cardoso", authorTitle: "Administradora Geral", publishedAt: "2026-09-28T09:00:00", updatedAt: "2026-09-28T09:00:00" },
  { id: "cir_3", number: "010/2026", subject: "Actualização dos dados de contacto dos moradores", body: "Exmos. Senhores Moradores,\n\nSolicitamos a actualização dos dados de contacto na Área de Moradores, de modo a garantir que todas as comunicações chegam aos destinatários.\n\nCom os melhores cumprimentos,", date: "2026-09-12", status: "publicada", audience: "Todos os moradores", author: "Paulo Sebastião", authorTitle: "Administrador do Condomínio", publishedAt: "2026-09-12T11:30:00", updatedAt: "2026-09-12T11:30:00" },
  { id: "cir_4", number: "013/2026", subject: "Assembleia Geral ordinária — convocatória", body: "Exmos. Senhores Condóminos,\n\nNos termos do regulamento do condomínio, convocam-se V. Exas. para a Assembleia Geral ordinária, com a seguinte ordem de trabalhos:\n\n1. Apreciação do relatório de contas;\n2. Aprovação do orçamento para 2027;\n3. Outros assuntos de interesse geral.\n\nCom os melhores cumprimentos,", date: "2026-10-17", status: "rascunho", audience: "Proprietários", author: "Helena Cardoso", authorTitle: "Administradora Geral", updatedAt: "2026-10-17T16:00:00" },
  { id: "cir_5", number: "008/2026", subject: "Horário de funcionamento da administração", body: "Exmos. Senhores Moradores,\n\nInformamos o horário de atendimento da administração do condomínio.\n\nCom os melhores cumprimentos,", date: "2026-07-02", status: "arquivada", audience: "Todos os moradores", author: "Paulo Sebastião", authorTitle: "Administrador do Condomínio", publishedAt: "2026-07-02T09:00:00", updatedAt: "2026-08-30T09:00:00" },
];

export const seedNotices: InternalNotice[] = [
  { id: "not_1", title: "Manutenção preventiva das piscinas", body: "As piscinas estarão encerradas para limpeza e tratamento da água. (Comunicado de demonstração)", category: "Manutenção", date: "2026-10-14", visibility: "publico", author: "Administração", pinned: true },
  { id: "not_2", title: "Convocatória para Assembleia Geral", body: "A ordem de trabalhos completa está disponível na secção de documentos. (Comunicado de demonstração)", category: "Assembleia", date: "2026-10-06", visibility: "publico", author: "Administração" },
  { id: "not_3", title: "Actualização do registo de visitantes", body: "Todos os visitantes deverão ser identificados na entrada principal. (Comunicado de demonstração)", category: "Segurança", date: "2026-09-25", visibility: "publico", author: "Administração" },
  { id: "not_4", title: "Corte programado de água — Bloco C", body: "Interrupção do abastecimento entre as 09h e as 12h para intervenção técnica. (Comunicado de demonstração)", category: "Manutenção", date: "2026-10-16", visibility: "moradores", author: "Administração" },
];

export const seedDocuments: CondoDocument[] = [
  { id: "doc_1", title: "Regulamento Interno do Condomínio", description: "Regras de convivência, utilização das áreas comuns e deveres dos moradores.", category: "regulamento", fileType: "PDF", size: 1_240_000, updatedAt: "2026-03-15", visibility: "moradores", uploadedBy: "Helena Cardoso" },
  { id: "doc_2", title: "Regulamento de Utilização das Piscinas", description: "Horários, normas de segurança e higiene.", category: "regulamento", fileType: "PDF", size: 420_000, updatedAt: "2026-09-28", visibility: "moradores", uploadedBy: "Paulo Sebastião" },
  { id: "doc_3", title: "Acta da Assembleia Geral — Março 2026", description: "Deliberações da assembleia ordinária.", category: "acta", fileType: "PDF", size: 860_000, updatedAt: "2026-03-30", visibility: "moradores", uploadedBy: "Helena Cardoso" },
  { id: "doc_4", title: "Acta da Assembleia Extraordinária — Julho 2026", description: "Aprovação de obras nas áreas comuns.", category: "acta", fileType: "PDF", size: 640_000, updatedAt: "2026-07-20", visibility: "moradores", uploadedBy: "Helena Cardoso" },
  { id: "doc_5", title: "Circular 012/2026 — Manutenção preventiva", description: "Plano de manutenção do 4.º trimestre.", category: "circular", fileType: "PDF", size: 210_000, updatedAt: "2026-10-10", visibility: "moradores", uploadedBy: "Paulo Sebastião" },
  { id: "doc_6", title: "Circular 011/2026 — Regras das piscinas", description: "Normas de utilização das piscinas.", category: "circular", fileType: "PDF", size: 190_000, updatedAt: "2026-09-28", visibility: "moradores", uploadedBy: "Helena Cardoso" },
  { id: "doc_7", title: "Comunicado — Corte programado de água", description: "Intervenção técnica no Bloco C.", category: "comunicado", fileType: "PDF", size: 120_000, updatedAt: "2026-10-16", visibility: "moradores", uploadedBy: "Paulo Sebastião" },
  { id: "doc_8", title: "Apresentação institucional do Residencial Laguna", description: "Documento de apresentação do condomínio.", category: "institucional", fileType: "PDF", size: 3_400_000, updatedAt: "2026-01-10", visibility: "publico", uploadedBy: "Helena Cardoso" },
  { id: "doc_9", title: "Orçamento anual 2026", description: "Orçamento aprovado em assembleia (demo).", category: "institucional", fileType: "XLSX", size: 96_000, updatedAt: "2026-03-30", visibility: "administracao", uploadedBy: "Marta Neto" },
  { id: "doc_10", title: "Contrato de manutenção de elevadores", description: "Contrato com prestador de serviços (demo).", category: "institucional", fileType: "DOCX", size: 310_000, updatedAt: "2026-02-01", visibility: "administracao", uploadedBy: "Helena Cardoso" },
];

export const seedNotifications: AppNotification[] = [
  { id: "ntf_1", title: "Novo comprovativo submetido", body: "Apartamento A-204 enviou comprovativo da quota de Outubro.", at: "2026-10-18T09:20:00", read: false, roles: ["admin_geral", "financeiro", "administrador"], href: "/painel/pagamentos" },
  { id: "ntf_2", title: "Ocorrência de prioridade alta", body: "Viatura estacionada em local indevido na entrada principal.", at: "2026-10-17T14:12:00", read: false, roles: ["admin_geral", "administrador", "porteiro"], href: "/painel/ocorrencias" },
  { id: "ntf_3", title: "Circular em rascunho", body: "A circular 013/2026 aguarda publicação.", at: "2026-10-17T16:05:00", read: true, roles: ["admin_geral", "administrador"], href: "/painel/circulares" },
  { id: "ntf_4", title: "Visitante a aguardar autorização", body: "Rita Mussungo — destino A-103.", at: "2026-10-18T10:30:00", read: false, roles: ["porteiro"], href: "/painel/portaria" },
  { id: "ntf_5", title: "Quota de Outubro disponível", body: "A quota de Outubro 2026 vence a 25/10/2026.", at: "2026-10-01T08:00:00", read: false, roles: ["morador"], href: "/painel/minhas-quotas" },
  { id: "ntf_6", title: "Nova circular publicada", body: "Circular 012/2026 — Plano de manutenção preventiva.", at: "2026-10-10T10:00:00", read: true, roles: ["morador"], href: "/painel/circulares" },
  { id: "ntf_7", title: "Visita registada", body: "Jorge Kapitango deu entrada às 09:15 para o seu apartamento.", at: "2026-10-18T09:15:00", read: false, roles: ["morador"] },
];
