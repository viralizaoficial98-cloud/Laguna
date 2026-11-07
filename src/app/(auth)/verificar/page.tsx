import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyView } from "@/components/auth/verify-view";

export const metadata: Metadata = { title: "Verificar documento", robots: { index: false } };

export default function VerificarPage() {
  return (
    <Suspense>
      <VerifyView />
    </Suspense>
  );
}
