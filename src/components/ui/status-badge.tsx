import { Badge, type BadgeTone } from "./badge";

/** Mapeamento central de estados → cor + texto (a cor nunca aparece sozinha). */
const MAP: Record<string, { label: string; tone: BadgeTone }> = {
  // quotas / pagamentos
  pendente: { label: "Pendente", tone: "neutral" },
  em_analise: { label: "Em análise", tone: "info" },
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
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const m = MAP[status] ?? { label: status, tone: "neutral" as const };
  return (
    <Badge tone={m.tone} dot className={className}>
      {m.label}
    </Badge>
  );
}

export function statusLabel(status: string) {
  return MAP[status]?.label ?? status;
}
