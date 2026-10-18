"use client";

import { LogOut, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { navForRole } from "@/config/navigation";
import type { Session } from "@/types";
import { roleLabels } from "@/data/users";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/site/logo";
import { Avatar } from "@/components/ui/avatar";

export function SidebarContent({ session, onNavigate, onLogout, onClose }: { session: Session; onNavigate?: () => void; onLogout: () => void; onClose?: () => void }) {
  const pathname = usePathname();
  const groups = navForRole(session.role);
  const isActive = (href: string) => (href === "/painel" ? pathname === "/painel" : pathname === href || pathname.startsWith(href + "/"));

  return (
    <div className="flex h-full flex-col bg-navy-950 text-navy-100">
      <div className="flex items-center justify-between px-6 pt-6 pb-5">
        <Logo variant="white" className="h-8" href="/painel" />
        {onClose && (
          <button onClick={onClose} className="rounded-lg p-1.5 text-navy-200 hover:bg-white/10" aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <div className="mx-4 mb-4 rounded-2xl border border-white/5 bg-white/[0.04] px-4 py-3">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-gold-400 uppercase">{roleLabels[session.role]}</p>
        <p className="mt-0.5 truncate text-sm text-white">{session.title}</p>
      </div>

      <nav className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-3 pb-6" aria-label="Menu do painel">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.2em] text-navy-300/50 uppercase">{g.label}</p>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors",
                        active ? "text-white" : "text-navy-200/75 hover:bg-white/[0.04] hover:text-white",
                      )}
                    >
                      {active && <motion.span layoutId="sidebar-active" className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/[0.12] to-white/[0.03] ring-1 ring-white/10" transition={{ type: "spring", bounce: 0.15, duration: 0.5 }} />}
                      {active && <span className="absolute top-1/2 -left-3 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gold-400" />}
                      <item.icon className={cn("relative h-[18px] w-[18px] transition-colors", active ? "text-gold-300" : "text-navy-300/70 group-hover:text-gold-300")} />
                      <span className="relative">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/5 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={session.name} size="sm" className="ring-navy-800" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{session.name}</p>
            <p className="truncate text-[11px] text-navy-300/70">{session.email}</p>
          </div>
          <button onClick={onLogout} className="rounded-lg p-2 text-navy-300 transition hover:bg-white/10 hover:text-white" aria-label="Terminar sessão" title="Terminar sessão">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
