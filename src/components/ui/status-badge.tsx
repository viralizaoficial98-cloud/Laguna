import { Badge, type BadgeTone } from "./badge";

/** Mapeamento central de estados → cor + texto (a cor nunca aparece sozinha). */
const MAP: Record<string, { label: string; tone: BadgeTone }> = {
  // quotas / pagamentos
  pendente: { label: "Pendente", tone: "neutral" },
  em_analise: { label: "Em validação", tone: "info" },
  parcial: { label: "Parcialmente pago", tone: "gold" },
  pago: { label: "Pago", tone: "success" },
  aprovado: { label: "Validado", tone: "success" },
  rejeitado: { label: "Rejeitado", tone: "danger" },
  em_atraso: { label: "Em atraso", tone: "warning" },
  // apartamentos
  ocupado: { label: "Ocupado", tone: "navy" },
  disponivel: { label: "Disponível", tone: "success" },
  manutencao: { label: "Manutenção", tone: "warning" },
  // moradores / utilizadores
  activo: { label: "Activo", tone: "success" },
  inactivo: { label: "Inactivo", tone: "neutral" },
  // circulares
  rascunho: { label: "Rascunho", tone: "neutral" },
  publicada: { label: "Publicada", tone: "success" },
  arquivada: { label: "Arquivada", tone: "violet" },
  // visitas
  autorizada: { label: "Autorizada", tone: "success" },
  cancelada: { label: "Cancelada", tone: "neutral" },
  aguardando: { label: "A aguardar entrada", tone: "warning" },
  no_interior: { label: "No interior", tone: "info" },
  saiu: { label: "Saiu", tone: "neutral" },
  // comunicados
  publicado: { label: "Publicado", tone: "success" },
  retirado: { label: "Retirado", tone: "violet" },
  // ocorrências
  aberta: { label: "Aberta", tone: "warning" },
  occ_em_analise: { label: "Em análise", tone: "info" },
  em_curso: { label: "Em curso", tone: "info" },
  em_execucao: { label: "Em execução", tone: "info" },
  resolvida: { label: "Resolvida", tone: "success" },
  baixa: { label: "Baixa", tone: "neutral" },
  media: { label: "Média", tone: "gold" },
  alta: { label: "Alta", tone: "warning" },
  urgente: { label: "Urgente", tone: "danger" },
  // elevadores
  operacional: { label: "Operacional", tone: "success" },
  avariado: { label: "Avariado", tone: "danger" },
  em_manutencao: { label: "Em manutenção", tone: "warning" },
  fora_servico: { label: "Fora de serviço", tone: "neutral" },
  // actividades operacionais
  programada: { label: "Programada", tone: "navy" },
  concluida: { label: "Concluída", tone: "success" },
  atrasada: { label: "Atrasada", tone: "danger" },
  conforme: { label: "Conforme", tone: "success" },
  nao_conforme: { label: "Não conforme", tone: "danger" },
  // reservas de salões
  em_espera: { label: "Lista de espera", tone: "violet" },
  pendente_pagamento: { label: "Pendente de pagamento", tone: "warning" },
  em_validacao: { label: "Em validação", tone: "info" },
  confirmada: { label: "Confirmada", tone: "success" },
  expirada: { label: "Expirada", tone: "neutral" },
  // desocupação
  solicitacao_recebida: { label: "Solicitação recebida", tone: "navy" },
  em_verificacao_financeira: { label: "Em verificação financeira", tone: "info" },
  em_verificacao_operacional: { label: "Em verificação operacional", tone: "info" },
  regularizacao_pendente: { label: "Regularização pendente", tone: "warning" },
  aguardando_aprovacao: { label: "Aguardando aprovação", tone: "gold" },
  regularizada: { label: "Regularizada", tone: "success" },
  com_pendencias: { label: "Com pendências", tone: "warning" },
  nao_aplicavel: { label: "Não aplicável", tone: "neutral" },
  // encargos
  proposto: { label: "Proposto", tone: "gold" },
  confirmado: { label: "Confirmado", tone: "warning" },
  anulado: { label: "Anulado", tone: "neutral" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const m = MAP[status] ?? { label: status, tone: "neutral" as const };
  return (
    <Badge tone={m.tone} dot className={className}>
      {m.label}
    </Badge>
  );
}

/** Estado de ocorrência ("em_analise" significa "Em análise", não "Em validação"). */
export const occStatus = (s: string) => (s === "em_analise" ? "occ_em_analise" : s);

export function statusLabel(status: string) {
  return MAP[status]?.label ?? status;
}
