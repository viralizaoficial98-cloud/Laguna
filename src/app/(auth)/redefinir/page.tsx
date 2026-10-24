import type { Metadata } from "next";
import { Suspense } from "react";
import { SetPasswordView } from "@/components/auth/set-password-view";

export const metadata: Metadata = { title: "Redefinir palavra-passe", robots: { index: false }, referrer: "no-referrer" };

export default function Page() {
  return (
    <Suspense>
      <SetPasswordView mode="reset" />
    </Suspense>
  );
}
