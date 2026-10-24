import type { Metadata } from "next";
import { ForgotView } from "@/components/auth/forgot-view";

export const metadata: Metadata = { title: "Recuperar palavra-passe", robots: { index: false } };

export default function RecuperarPage() {
  return <ForgotView />;
}
