"use client";

import Link from "next/link";
import { useDemoStore } from "@/store/demo-store";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OpsAlerts } from "@/components/app/widgets/ops-alerts";

export default function NotificacoesPage() {
  const notifications = useDemoStore((s) => s.notifications);
  const markRead = useDemoStore((s) => s.markNotificationsRead);
  const unread = notifications.filter((n) => !n.read);
  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Alertas e notificações"
        description="Pedidos, validações e alertas dirigidos ao seu perfil."
        actions={
          unread.length ? (
            <Button variant="outline" onClick={() => markRead(unread.map((n) => n.id))}>
              Marcar todas como lidas
            </Button>
          ) : undefined
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <ul className="divide-y divide-graphite-100">
            {notifications.map((n) => (
              <li key={n.id} className={`flex items-start justify-between gap-3 px-5 py-3 text-sm ${n.read ? "" : "bg-gold-50/40"}`}>
                <span>
                  <strong className="text-navy-900">{n.title}</strong>
                  <span className="block text-graphite-600">{n.body}</span>
                  <span className="text-xs text-graphite-400">{formatDateTime(n.at)}</span>
                </span>
                {n.href && (
                  <Link href={n.href} onClick={() => markRead([n.id])} className="shrink-0 text-xs font-medium text-navy-700">
                    Abrir
                  </Link>
                )}
              </li>
            ))}
            {!notifications.length && <li className="px-5 py-8 text-sm text-graphite-400">Sem notificações.</li>}
          </ul>
        </Card>
        <OpsAlerts />
      </div>
    </>
  );
}
