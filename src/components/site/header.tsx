"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { publicNav } from "@/config/site";
import { cn } from "@/lib/utils";
import { useLockBody } from "@/hooks/use-lock-body";
import { buttonClass } from "@/components/ui/button";
import { Logo } from "./logo";

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const transparent = pathname === "/" && !scrolled && !open;
  useLockBody(open);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        transparent ? "bg-gradient-to-b from-navy-950/70 to-transparent py-5" : "border-b border-graphite-100/80 bg-white/90 py-3 shadow-soft backdrop-blur-xl",
      )}
    >
      <div className="container-site flex items-center justify-between gap-6">
        <Logo variant={transparent ? "white" : "color"} className="h-8 sm:h-9" />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação principal">
          {publicNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative px-3 py-2 text-[13px] font-medium tracking-wide transition-colors",
                transparent ? "text-white/85 hover:text-white" : "text-graphite-600 hover:text-navy-900",
                isActive(item.href) && (transparent ? "text-white" : "text-navy-900"),
              )}
            >
              {item.label}
              <span className={cn("absolute inset-x-3 -bottom-0.5 h-px origin-left bg-gold-500 transition-transform duration-300", isActive(item.href) ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100")} />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login" className={buttonClass(transparent ? "white" : "gold", "md", "hidden sm:inline-flex")}>
            <UserRound className="h-4 w-4" />
            Área de Moradores
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            className={cn("rounded-xl p-2 lg:hidden", transparent ? "text-white hover:bg-white/10" : "text-navy-900 hover:bg-graphite-100")}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "calc(100dvh - 64px)" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden bg-white lg:hidden"
          >
            <nav className="container-site flex h-full flex-col gap-1 py-6" aria-label="Navegação móvel">
              {publicNav.map((item, i) => (
                <motion.div key={item.href} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn("flex items-center justify-between border-b border-graphite-100 py-4 font-display text-2xl", isActive(item.href) ? "text-gold-600" : "text-navy-900")}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
              <Link href="/login" onClick={() => setOpen(false)} className={buttonClass("primary", "lg", "mt-6 w-full")}>
                <UserRound className="h-4 w-4" /> Área de Moradores
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
