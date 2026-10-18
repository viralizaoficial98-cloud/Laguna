import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";

export const metadata: Metadata = { title: { default: "Painel", template: "%s · Painel Laguna" }, robots: { index: false } };

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
