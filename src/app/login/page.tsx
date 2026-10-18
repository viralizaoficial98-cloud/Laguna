import type { Metadata } from "next";
import { LoginView } from "@/components/app/login-view";

export const metadata: Metadata = { title: "Área de Moradores — Entrar" };

export default function LoginPage() {
  return <LoginView />;
}
