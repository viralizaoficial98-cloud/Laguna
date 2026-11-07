"use client";

import { Suspense } from "react";
import { DeclarationsView } from "@/components/app/mgmt/declarations-view";

export default function Page() {
  return (
    <Suspense>
      <DeclarationsView mode="assinados" />
    </Suspense>
  );
}
