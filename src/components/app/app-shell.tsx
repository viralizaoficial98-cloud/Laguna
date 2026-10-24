"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ShieldX } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { canAccess } from "@/config/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useDemoStore } from "@/store/demo-store";
import { useLockBody } from "@/hooks/use-lock-body";
import { buttonClass } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SidebarContent } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const session = useAuthStore((s) => s.session);
  const checked = useAuthStore((s) => s.checked);
  const loadSession = useAuthStore((s) => s.load);
  const logout = useAuthStore((s) => s.logout);
  const loaded = useDemoStore((s) => s.loaded);
  const loadError = useDemoStore((s) => s.loadError);
  const refresh = useDemoStore((s) => s.refresh);
  const clear = useDemoStore((s) => s.clear);
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  useLockBody(mobileOpen);

  // sessão verificada no servidor (cookie httpOnly)
  useEffect(() => {
    if (!checked) void loadSession();
  }, [checked, loadSession]);

  useEffect(() => {
    if (checked && !session) {
      clear();
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [checked, session, router, pathname, clear]);

  // dados da base de dados + sincronização entre dispositivos (periódica e ao voltar ao separador)
  useEffect(() => {
    if (!session) return;
    void refresh(true);
    const tick = () => document.visibilityState === "visible" && void refresh();
    const id = window.setInterval(tick, 15_000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [session, refresh]);

  const handleLogout = async () => {
    await logout();
    clear();
    toast.success("Sessão terminada.");
    router.replace("/login");
  };

  if (session && loadError && !loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-graphite-50 p-6">
        <div className="max-w-md rounded-3xl border border-graphite-100 bg-white p-8 text-center">
          <p className="font-medium text-navy-900">Não foi possível carregar os dados</p>
          <p className="mt-2 text-sm text-graphite-500">{loadError}</p>
          <button className={buttonClass("primary", "md", "mt-5")} onClick={() => void refresh(true)}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!session || !loaded) {
    return (
      <div className="min-h-screen bg-graphite-50 p-6 lg:pl-[300px]">
        <PageSkeleton />
      </div>
    );
  }

  const allowed = canAccess(session.role, pathname);

  return (
    <div className="min-h-screen bg-graphite-50">
      {/* Sidebar desktop */}
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-[272px] lg:block">
        <SidebarContent session={session} onLogout={handleLogout} />
      </aside>

      {/* Sidebar móvel */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
            <motion.aside className="absolute inset-y-0 left-0 w-[85%] max-w-[300px] shadow-lift" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", bounce: 0, duration: 0.4 }}>
              <SidebarContent session={session} onLogout={handleLogout} onNavigate={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="lg:pl-[272px] print:pl-0">
        <Topbar session={session} onMenu={() => setMobileOpen(true)} onLogout={handleLogout} />
        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Suspense fallback={<PageSkeleton />}>
            <motion.div key={pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
              {allowed ? (
                children
              ) : (
                <div className="rounded-3xl border border-graphite-100 bg-white">
                  <EmptyState
                    icon={ShieldX}
                    title="Acesso não disponível para este perfil"
                    description="Esta área não faz parte das permissões do seu perfil."
                    action={
                      <Link href="/painel" className={buttonClass("primary")}>
                        Voltar ao dashboard
                      </Link>
                    }
                  />
                </div>
              )}
            </motion.div>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
