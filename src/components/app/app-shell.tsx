"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ShieldX } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { canAccess } from "@/config/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { useLockBody } from "@/hooks/use-lock-body";
import { logout } from "@/services/auth.service";
import { buttonClass } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SidebarContent } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  useLockBody(mobileOpen);

  useEffect(() => {
    if (hydrated && !session) router.replace("/login");
  }, [hydrated, session, router]);

  const handleLogout = async () => {
    await logout();
    setSession(null);
    toast.success("Sessão terminada.");
    router.replace("/login");
  };

  if (!hydrated || !session) {
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
                    description="Esta área não faz parte das permissões do seu perfil de demonstração."
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
