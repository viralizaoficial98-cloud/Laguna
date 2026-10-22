"use client";

import Image from "next/image";
import { Building2, Layers, Ruler, UserRound, Users } from "lucide-react";
import { useCurrentResident } from "@/hooks/use-session";
import { useDemoStore } from "@/store/demo-store";
import { formatDate, formatKz } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DemoDataNote } from "@/components/ui/demo-badge";
import { AccountStatement } from "@/components/app/widgets/account-statement";

export default function MeuApartamentoPage() {
  const { resident, apartment } = useCurrentResident();
  const quarterly = useDemoStore((s) => s.settings.quarterlyQuota);
  if (!apartment || !resident) return <p className="text-sm text-graphite-500">Sem apartamento associado.</p>;

  return (
    <>
      <PageHeader eyebrow="Minha área" title="Meu apartamento" description="Dados do apartamento, agregado familiar e conta corrente." actions={<DemoDataNote />} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <div className="relative h-48 sm:h-56">
            <Image src="/images/laguna/fachadas/edificio-residencial.webp" alt="Edifício residencial do Residencial Laguna" fill sizes="(min-width:1280px) 66vw, 100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-navy-950/85 to-transparent" />
            <div className="absolute bottom-5 left-6 text-white">
              <p className="text-xs tracking-[0.2em] text-gold-300 uppercase">Bloco {apartment.block}</p>
              <p className="font-display text-4xl">Apartamento {apartment.number}</p>
            </div>
          </div>
          <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { icon: Building2, label: "Tipologia", value: apartment.typology ?? "Por definir" },
              { icon: Layers, label: "Andar", value: `${apartment.floor}.º` },
              { icon: Ruler, label: "Quota trimestral", value: formatKz(quarterly) },
              { icon: UserRound, label: "Proprietário", value: apartment.ownerName },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-graphite-50 p-4">
                <s.icon className="h-4 w-4 text-gold-600" />
                <p className="mt-2 text-xs text-graphite-500">{s.label}</p>
                <p className="font-semibold text-navy-900">{s.value}</p>
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Agregado familiar" action={<Users className="h-4 w-4 text-graphite-400" />} />
          <ul className="divide-y divide-graphite-100">
            <li className="flex items-center justify-between px-5 py-3">
              <span>
                <span className="block text-sm font-medium text-navy-900">{resident.name}</span>
                <span className="block text-xs text-graphite-500">Titular · desde {formatDate(resident.since)}</span>
              </span>
              <StatusBadge status={resident.status} />
            </li>
            {resident.dependents.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-navy-900">{d.name}</span>
                <span className="text-xs text-graphite-500">
                  {d.relation}
                  {d.birthYear ? ` · ${d.birthYear}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="mt-6">
        <AccountStatement apartmentId={apartment.id} />
      </div>
    </>
  );
}
