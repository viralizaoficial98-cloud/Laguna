import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginView } from "@/components/app/login-view";

export const metadata: Metadata = { title: "Área de Moradores — Entrar" };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}
