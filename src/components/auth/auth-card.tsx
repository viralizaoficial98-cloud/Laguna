import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/site/logo";

/** Moldura das páginas de autenticação (recuperação, activação e redefinição). */
export function AuthCard({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-graphite-50">
      <div className="flex items-center justify-between p-5 sm:p-8">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm text-graphite-500 transition hover:text-navy-900">
          <ArrowLeft className="h-4 w-4" /> Iniciar sessão
        </Link>
      </div>
      <div className="flex flex-1 items-start justify-center px-4 pb-16 sm:items-center">
        <div className="w-full max-w-md rounded-3xl border border-graphite-100 bg-white p-6 shadow-soft sm:p-8">
          <Logo className="mb-8 h-10" href={null} />
          <h1 className="font-display text-3xl text-navy-900">{title}</h1>
          {description && <div className="mt-2 text-sm text-graphite-500">{description}</div>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
