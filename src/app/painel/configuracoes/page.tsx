"use client";

import Link from "next/link";
import { Bell, Building, Check, Minus, Palette, Settings2, ShieldCheck, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { siteConfig } from "@/config/site";
import { appNavigation } from "@/config/navigation";
import { ROLES, roleDescriptions, roleLabels } from "@/data/users";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { DemoBadge } from "@/components/ui/demo-badge";

type Tab = "instituicao" | "utilizadores" | "perfis" | "preferencias" | "notificacoes" | "personalizacao";

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState<Tab>("instituicao");
  return (
    <>
      <PageHeader eyebrow="Administração" title="Configurações" description="Dados institucionais, utilizadores, perfis e preferências da plataforma." actions={<DemoBadge label="Preferências visuais — não guardadas" />} />
      <Tabs<Tab>
        className="mb-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "instituicao", label: "Dados institucionais" },
          { id: "utilizadores", label: "Utilizadores" },
          { id: "perfis", label: "Perfis e permissões" },
          { id: "preferencias", label: "Preferências" },
          { id: "notificacoes", label: "Notificações" },
          { id: "personalizacao", label: "Personalização" },
        ]}
      />
      {tab === "instituicao" && <Institution />}
      {tab === "utilizadores" && <UsersTab />}
      {tab === "perfis" && <Profiles />}
      {tab === "preferencias" && <Preferences />}
      {tab === "notificacoes" && <NotificationsTab />}
      {tab === "personalizacao" && <Personalization />}
    </>
  );
}

function saved() {
  toast.info("Os dados institucionais estão definidos na configuração do portal (src/config/site.ts).", { description: "A edição pelo painel não está disponível nesta versão." });
}

function Institution() {
  return (
    <Card>
      <CardHeader title="Dados institucionais" description="Campos vazios aguardam confirmação oficial pela administração." action={<Building className="h-4 w-4 text-graphite-400" />} />
      <CardBody className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome oficial">
          <Input defaultValue={siteConfig.name} />
        </Field>
        <Field label="Domínio">
          <Input defaultValue={siteConfig.url} />
        </Field>
        <Field label="Administrador do condomínio">
          <Input defaultValue={siteConfig.administrator.name} />
        </Field>
        <Field label="Cargo / assinatura">
          <Input defaultValue={siteConfig.administrator.signatureTitle} />
        </Field>
        <Field label="Morada">
          <Input defaultValue={`${siteConfig.location.address}, Luanda, Angola`} />
        </Field>
        <Field label="Referência das circulares" hint="Ex.: 04/ADMLR/2026">
          <Input defaultValue={siteConfig.circularRef} />
        </Field>
        <Field label="NIF do condomínio" hint="Por confirmar">
          <Input placeholder="—" />
        </Field>
        <Field label="Telefone (rodapé oficial)">
          <Input placeholder="+244 …" defaultValue={siteConfig.contacts.phone ?? ""} />
        </Field>
        <Field label="Telefone da Administração">
          <Input placeholder="+244 …" defaultValue={siteConfig.contacts.adminPhone ?? ""} />
        </Field>
        <Field label="Email oficial" hint="Por confirmar">
          <Input placeholder="geral@residenciallaguna.ao" defaultValue={siteConfig.contacts.email ?? ""} />
        </Field>
        <Field label="IBAN para pagamento de quotas" hint="Será apresentado ao morador no momento do pagamento" className="sm:col-span-2">
          <Input placeholder="AO06 …" />
        </Field>
        <Field label="Texto institucional" className="sm:col-span-2">
          <Textarea rows={4} defaultValue={siteConfig.description} />
        </Field>
        <div className="flex justify-end sm:col-span-2">
          <Button onClick={saved}>Guardar alterações</Button>
        </div>
      </CardBody>
    </Card>
  );
}

function UsersTab() {
  return (
    <Card>
      <CardHeader title="Gestão de utilizadores" description="As contas são geridas no módulo Gestão de Utilizadores (base de dados)." />
      <CardBody>
        <p className="text-sm text-graphite-600">Criação de contas, perfis, activação, bloqueio, redefinição de palavra-passe e histórico de acessos.</p>
        <Link href="/painel/utilizadores" className={buttonClass("primary", "md", "mt-4")}>
          <UserPlus className="h-4 w-4" /> Abrir Gestão de Utilizadores
        </Link>
      </CardBody>
    </Card>
  );
}

function Profiles() {
  const items = appNavigation.flatMap((g) => g.items);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {ROLES.map((r) => (
          <div key={r} className="rounded-2xl border border-graphite-100 bg-white p-5 shadow-soft">
            <ShieldCheck className="h-5 w-5 text-gold-600" />
            <p className="mt-3 font-semibold text-navy-900">{roleLabels[r]}</p>
            <p className="mt-1 text-xs text-graphite-500">{roleDescriptions[r]}</p>
            <p className="mt-3 text-xs font-medium text-navy-700">{items.filter((i) => i.roles.includes(r)).length} módulos</p>
          </div>
        ))}
      </div>
      <Card>
        <CardHeader title="Matriz de permissões" description="Acesso aos módulos por perfil (definido em src/config/navigation.ts)" />
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-graphite-100 bg-graphite-50/70 text-[11px] tracking-wider text-graphite-500 uppercase">
                <th className="px-4 py-3 text-left">Módulo</th>
                {ROLES.map((r) => <th key={r} className="px-3 py-3 text-center">{roleLabels[r]}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-100">
              {items.map((i) => (
                <tr key={i.href}>
                  <td className="px-4 py-2.5"><span className="flex items-center gap-2 font-medium text-navy-900"><i.icon className="h-4 w-4 text-graphite-400" />{i.label}</span></td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-3 py-2.5 text-center">
                      {i.roles.includes(r) ? <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Com acesso" /> : <Minus className="mx-auto h-4 w-4 text-graphite-300" aria-label="Sem acesso" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Toggle({ label, description, defaultOn }: { label: string; description?: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <div className="flex items-center justify-between gap-6 py-3.5">
      <div>
        <p className="text-sm font-medium text-navy-900">{label}</p>
        {description && <p className="text-xs text-graphite-500">{description}</p>}
      </div>
      <button role="switch" aria-checked={on} aria-label={label} onClick={() => setOn(!on)} className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-navy-900" : "bg-graphite-200")}>
        <span className={cn("absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", on && "translate-x-5")} />
      </button>
    </div>
  );
}

function Preferences() {
  return (
    <Card>
      <CardHeader title="Preferências gerais" action={<Settings2 className="h-4 w-4 text-graphite-400" />} />
      <CardBody className="grid gap-4 sm:grid-cols-2">
        <Field label="Idioma"><Select defaultValue="pt-AO"><option value="pt-AO">Português (Angola)</option><option value="pt-PT">Português (Portugal)</option></Select></Field>
        <Field label="Moeda"><Select defaultValue="AOA"><option value="AOA">Kwanza (AOA / Kz)</option></Select></Field>
        <Field label="Periodicidade das quotas"><Select defaultValue="trimestral" disabled><option value="trimestral">Trimestral (Jan–Mar, Abr–Jun, Jul–Set, Out–Dez)</option></Select></Field>
        <Field label="Fuso horário"><Select defaultValue="Africa/Luanda"><option>Africa/Luanda</option></Select></Field>
        <div className="divide-y divide-graphite-100 sm:col-span-2">
          <Toggle label="Permitir pagamentos parciais" description="Aceitar comprovativos com valor inferior à quota" />
          <Toggle label="Aprovação dupla de pagamentos" description="Exigir validação do Financeiro e do Administrador" />
          <Toggle label="Mostrar indicadores no portal público" defaultOn description="Apenas valores confirmados" />
        </div>
        <div className="flex justify-end sm:col-span-2"><Button onClick={saved}>Guardar</Button></div>
      </CardBody>
    </Card>
  );
}

function NotificationsTab() {
  return (
    <Card>
      <CardHeader title="Notificações" description="Canais e eventos (simulação)" action={<Bell className="h-4 w-4 text-graphite-400" />} />
      <CardBody className="divide-y divide-graphite-100">
        <Toggle label="Novo comprovativo submetido" description="Notificar Financeiro e Administração" defaultOn />
        <Toggle label="Pagamento aprovado / rejeitado" description="Notificar o morador" defaultOn />
        <Toggle label="Lembrete de quota a vencer" description="5 dias antes do vencimento" defaultOn />
        <Toggle label="Nova circular publicada" description="Notificar todos os moradores" defaultOn />
        <Toggle label="Ocorrência de prioridade alta" description="Notificar Administração e Portaria" defaultOn />
        <Toggle label="Envio por email" description="Disponível após configuração do servidor de email" />
        <Toggle label="Envio por SMS / WhatsApp" description="Integração futura" />
        <div className="flex justify-end pt-4"><Button onClick={saved}>Guardar</Button></div>
      </CardBody>
    </Card>
  );
}

function Personalization() {
  const [accent, setAccent] = useState("gold");
  return (
    <Card>
      <CardHeader title="Personalização" action={<Palette className="h-4 w-4 text-graphite-400" />} />
      <CardBody>
        <p className="mb-3 text-sm font-medium text-navy-900">Cor de destaque</p>
        <div className="flex flex-wrap gap-3">
          {[
            { id: "gold", label: "Dourado premium", c: "bg-gold-500" },
            { id: "navy", label: "Azul-marinho", c: "bg-navy-700" },
            { id: "graphite", label: "Grafite", c: "bg-graphite-700" },
          ].map((a) => (
            <button key={a.id} onClick={() => setAccent(a.id)} className={cn("flex items-center gap-3 rounded-2xl border p-3 pr-5 transition", accent === a.id ? "border-navy-900 ring-2 ring-navy-100" : "border-graphite-200 hover:border-navy-300")}>
              <span className={cn("h-8 w-8 rounded-xl", a.c)} />
              <span className="text-sm text-navy-900">{a.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-6 divide-y divide-graphite-100">
          <Toggle label="Animações da interface" defaultOn description="Desactivar para dispositivos mais lentos" />
          <Toggle label="Modo compacto nas tabelas" />
          <Toggle label="Sidebar recolhida por defeito" />
        </div>
        <div className="mt-4 flex justify-end"><Button onClick={saved}>Guardar</Button></div>
        <p className="mt-2 text-right text-xs text-graphite-400"><Users className="mr-1 inline h-3 w-3" />Preferências aplicáveis por utilizador na fase de backend.</p>
      </CardBody>
    </Card>
  );
}
