"use client";

import { CalendarDays, Clock, LogIn, LogOut, PartyPopper, Phone, User, UserRound } from "lucide-react";
import { toast } from "sonner";
import { guestPresence, useDemoStore } from "@/store/demo-store";
import { useSession } from "@/hooks/use-session";
import { can } from "@/config/permissions";
import type { VisitRow } from "@/hooks/use-visits";
import { formatDate, formatDateTime, formatTime } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";

/**
 * Detalhe de uma autorização de visita. A Portaria confirma entrada/saída de cada
 * convidado; a autorização original (criada pelo morador) é apenas de leitura.
 */
export function VisitDetailModal({ visit, onClose }: { visit: VisitRow | null; onClose: () => void }) {
  const session = useSession();
  const checks = useDemoStore((s) => s.visitChecks);
  const checkGuest = useDemoStore((s) => s.checkGuest);
  const canCheck = can(session?.role, "visits.check") && visit?.status === "autorizada";

  const doCheck = (guestId: string, name: string, type: "entrada" | "saida") => {
    if (!visit) return;
    try {
      checkGuest(visit.id, guestId, type);
      toast.success(`${type === "entrada" ? "Entrada" : "Saída"} confirmada: ${name}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const history = visit ? checks.filter((c) => c.visitId === visit.id).sort((a, b) => b.at.localeCompare(a.at)) : [];

  return (
    <Modal
      open={!!visit}
      onClose={onClose}
      size="lg"
      title={visit ? (visit.kind === "grupo" ? visit.eventName ?? "Visita de grupo" : visit.guests[0]?.name) : ""}
      description={visit ? `Bloco ${visit.block} · Apartamento ${visit.number}` : ""}
    >
      {visit && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {visit.kind === "grupo" ? (
              <Badge tone="violet">
                <PartyPopper className="h-3 w-3" /> Visita de grupo · {visit.eventType}
              </Badge>
            ) : (
              <Badge tone="navy">
                <User className="h-3 w-3" /> Visita individual
              </Badge>
            )}
            <StatusBadge status={visit.status} />
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              { icon: UserRound, k: "Morador responsável", v: visit.residentName },
              { icon: CalendarDays, k: "Data", v: formatDate(visit.date) },
              { icon: Clock, k: "Horário previsto", v: visit.time },
              { icon: User, k: visit.kind === "grupo" ? "Convidados" : "Pessoas", v: `${visit.guests.length}` },
            ].map((it) => (
              <div key={it.k} className="rounded-xl bg-graphite-50 p-3">
                <dt className="flex items-center gap-1.5 text-xs text-graphite-500">
                  <it.icon className="h-3.5 w-3.5" /> {it.k}
                </dt>
                <dd className="mt-0.5 font-medium text-navy-900">{it.v}</dd>
              </div>
            ))}
          </dl>
          {visit.notes && <p className="rounded-xl border border-graphite-100 p-3 text-sm text-graphite-600">{visit.notes}</p>}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-navy-900">{visit.kind === "grupo" ? "Lista de convidados" : "Visitante"}</p>
              <p className="text-xs text-graphite-500">
                {visit.inside} no interior · {visit.left} saíram · {visit.waiting} a aguardar
              </p>
            </div>
            <ul className="divide-y divide-graphite-100 rounded-xl border border-graphite-100">
              {visit.guests.map((g, i) => {
                const p = guestPresence(checks, visit.id, g.id);
                return (
                  <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="w-6 text-right text-xs text-graphite-400 tabular-nums">{i + 1}.</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-navy-900">{g.name}</span>
                        {g.phone && (
                          <span className="flex items-center gap-1 text-xs text-graphite-500">
                            <Phone className="h-3 w-3" /> {g.phone}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={p} />
                      {canCheck && p !== "no_interior" && (
                        <Button size="sm" variant="subtle" onClick={() => doCheck(g.id, g.name, "entrada")}>
                          <LogIn className="h-3.5 w-3.5" /> Entrada
                        </Button>
                      )}
                      {canCheck && p === "no_interior" && (
                        <Button size="sm" variant="outline" onClick={() => doCheck(g.id, g.name, "saida")}>
                          <LogOut className="h-3.5 w-3.5" /> Saída
                        </Button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            {!canCheck && visit.status === "autorizada" && <p className="mt-2 text-xs text-graphite-400">Consulta apenas — a confirmação de entrada/saída é feita pela Portaria.</p>}
          </div>

          {history.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-navy-900">Histórico de confirmações</p>
              <ul className="space-y-1 text-xs text-graphite-600">
                {history.map((c) => (
                  <li key={c.id} className="flex justify-between gap-3 rounded-lg bg-graphite-50 px-3 py-1.5">
                    <span>
                      <span className={c.type === "entrada" ? "text-emerald-700" : "text-graphite-500"}>{c.type === "entrada" ? "Entrada" : "Saída"}</span> ·{" "}
                      {visit.guests.find((g) => g.id === c.guestId)?.name}
                    </span>
                    <span className="tabular-nums" title={formatDateTime(c.at)}>
                      {formatDate(c.at, { day: "2-digit", month: "2-digit" })} {formatTime(c.at)} · {c.by}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-graphite-400">Autorização registada pelo morador em {formatDateTime(visit.createdAt)}.</p>
        </div>
      )}
    </Modal>
  );
}
