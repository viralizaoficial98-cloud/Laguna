import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

export function DemoBadge({ className, label = "Ambiente de Demonstração" }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-gold-300/60 bg-gold-50 px-2.5 py-1 text-[11px] font-medium text-gold-800", className)}>
      <FlaskConical className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export function DemoDataNote({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <p className={cn("inline-flex items-center gap-1.5 text-[11px] text-graphite-500", className)}>
      <FlaskConical className="h-3.5 w-3.5 text-gold-600" />
      {children ?? "Inclui dados iniciais de demonstração — a validar pela Administração"}
    </p>
  );
}
