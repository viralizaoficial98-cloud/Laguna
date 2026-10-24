"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bell, Building2, ChevronDown, ExternalLink, LogOut, Menu, Search, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@/types";
import { navForRole } from "@/config/navigation";
import { can } from "@/config/permissions";
import { useDemoStore } from "@/store/demo-store";
import { roleLabels } from "@/data/users";
import { cn, formatDateTime, includesText } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { DemoBadge } from "@/components/ui/demo-badge";

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOutside();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onOutside]);
  return ref;
}

const dropdown = {
  initial: { opacity: 0, y: -6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -6, scale: 0.98 },
  transition: { duration: 0.18 },
};

export function Topbar({ session, onMenu, onLogout }: { session: Session; onMenu: () => void; onLogout: () => void }) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-graphite-100 bg-white/85 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button onClick={onMenu} className="rounded-xl p-2 text-navy-900 hover:bg-graphite-100 lg:hidden" aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </button>
        <GlobalSearch session={session} />
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {process.env.NEXT_PUBLIC_ENV_LABEL && <DemoBadge className="hidden md:inline-flex" label={process.env.NEXT_PUBLIC_ENV_LABEL} />}
          <Notifications session={session} />
          <ProfileMenu session={session} onLogout={onLogout} />
        </div>
      </div>
    </header>
  );
}

function GlobalSearch({ session }: { session: Session }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const apartments = useDemoStore((s) => s.apartments);
  const residents = useDemoStore((s) => s.residents);
  const staff = can(session.role, "residents.view");

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const pages = navForRole(session.role)
      .flatMap((g) => g.items)
      .filter((i) => includesText([i.label], q))
      .map((i) => ({ key: i.href, label: i.label, sub: "Página", href: i.href, icon: i.icon }));
    const apts = staff
      ? apartments
          .filter((a) => includesText([`Bloco ${a.block} ${a.number}`, `${a.block}-${a.number}`, `${a.block}${a.number}`, a.ownerName], q))
          .slice(0, 4)
          .map((a) => ({ key: a.id, label: `Bloco ${a.block} · Apartamento ${a.number}`, sub: a.ownerName || "Sem proprietário registado", href: `/painel/apartamentos?q=${a.block}-${a.number}`, icon: Building2 }))
      : [];
    const res = staff
      ? residents
          .filter((r) => includesText([r.name, r.email], q))
          .slice(0, 4)
          .map((r) => ({ key: r.id, label: r.name, sub: "Morador", href: `/painel/moradores?q=${encodeURIComponent(r.name)}`, icon: Users }))
      : [];
    return [...pages, ...apts, ...res].slice(0, 9);
  }, [q, session.role, staff, apartments, residents]);

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-graphite-400" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={staff ? "Pesquisar páginas, fracções (ex.: 06-201), moradores…" : "Pesquisar no painel…"}
        className="h-10 w-full rounded-xl border border-transparent bg-graphite-100/80 pr-3 pl-9 text-sm placeholder:text-graphite-400 focus:border-navy-200 focus:bg-white focus:ring-4 focus:ring-navy-50 focus:outline-none"
        aria-label="Pesquisa global"
      />
      <AnimatePresence>
        {open && q && (
          <motion.div {...dropdown} className="absolute top-12 right-0 left-0 overflow-hidden rounded-2xl border border-graphite-100 bg-white p-1.5 shadow-lift">
            {results.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-graphite-500">Sem resultados para “{q}”.</p>
            ) : (
              results.map((r) => (
                <button
                  key={r.key}
                  onClick={() => {
                    router.push(r.href);
                    setOpen(false);
                    setQ("");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-navy-50"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
                    <r.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-navy-900">{r.label}</span>
                    <span className="block truncate text-xs text-graphite-500">{r.sub}</span>
                  </span>
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Notifications({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const all = useDemoStore((s) => s.notifications);
  const markRead = useDemoStore((s) => s.markNotificationsRead);
  const items = useMemo(() => all.filter((n) => n.roles.includes(session.role)).sort((a, b) => b.at.localeCompare(a.at)), [all, session.role]);
  const unread = items.filter((n) => !n.read);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative rounded-xl p-2.5 text-graphite-600 transition hover:bg-graphite-100 hover:text-navy-900" aria-label={`Notificações (${unread.length} por ler)`}>
        <Bell className="h-5 w-5" />
        {unread.length > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[9px] font-bold text-navy-950 ring-2 ring-white">{unread.length}</span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div {...dropdown} className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-graphite-100 bg-white shadow-lift sm:absolute sm:inset-x-auto sm:top-12 sm:right-0 sm:w-96">
            <div className="flex items-center justify-between border-b border-graphite-100 px-4 py-3">
              <p className="font-semibold text-navy-900">Notificações</p>
              {unread.length > 0 && (
                <button onClick={() => markRead(unread.map((n) => n.id))} className="text-xs font-medium text-navy-600 hover:text-navy-900">
                  Marcar todas como lidas
                </button>
              )}
            </div>
            <ul className="scrollbar-thin max-h-96 overflow-y-auto">
              {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-graphite-500">Sem notificações.</li>}
              {items.map((n) => (
                <li key={n.id} className={cn("border-b border-graphite-50 last:border-0", !n.read && "bg-navy-50/40")}>
                  <Link
                    href={n.href ?? "#"}
                    onClick={() => {
                      markRead([n.id]);
                      setOpen(false);
                    }}
                    className="flex gap-3 px-4 py-3 hover:bg-graphite-50"
                  >
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-graphite-200" : "bg-gold-500")} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-navy-900">{n.title}</span>
                      <span className="block text-xs text-graphite-500">{n.body}</span>
                      <span className="mt-1 block text-[11px] text-graphite-400">{formatDateTime(n.at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="bg-graphite-50 px-4 py-2 text-center text-[11px] text-graphite-400">Notificações demonstrativas</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfileMenu({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-xl p-1 pr-2 transition hover:bg-graphite-100" aria-label="Menu de perfil">
        <Avatar name={session.name} size="sm" />
        <span className="hidden text-left md:block">
          <span className="block max-w-36 truncate text-sm leading-tight font-medium text-navy-900">{session.name}</span>
          <span className="block text-[11px] leading-tight text-graphite-500">{roleLabels[session.role]}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-graphite-400 md:block" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div {...dropdown} className="absolute top-12 right-0 w-64 overflow-hidden rounded-2xl border border-graphite-100 bg-white p-1.5 shadow-lift">
            <div className="px-3 py-2.5">
              <p className="text-sm font-semibold text-navy-900">{session.name}</p>
              <p className="truncate text-xs text-graphite-500">{session.email}</p>
            </div>
            <div className="my-1 h-px bg-graphite-100" />
            <MenuLink href="/painel/perfil" icon={UserRound} onClick={() => setOpen(false)}>
              Meu perfil
            </MenuLink>
            <MenuLink href="/" icon={ExternalLink} onClick={() => setOpen(false)}>
              Portal público
            </MenuLink>
            <div className="my-1 h-px bg-graphite-100" />
            <button onClick={onLogout} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-red-50">
              <LogOut className="h-4 w-4" /> Terminar sessão
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuLink({ href, icon: Icon, children, onClick }: { href: string; icon: typeof UserRound; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-graphite-700 hover:bg-graphite-50">
      <Icon className="h-4 w-4 text-graphite-400" /> {children}
    </Link>
  );
}
