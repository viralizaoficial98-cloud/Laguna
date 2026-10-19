"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { Typology } from "@/types";
import { cn } from "@/lib/utils";
import { ApartmentCard } from "./apartment-card";

export function ApartmentsExplorer({ typologies }: { typologies: Typology[] }) {
  const [bedrooms, setBedrooms] = useState<number | "all">("all");
  const options = useMemo(() => Array.from(new Set(typologies.map((t) => t.bedrooms))).sort(), [typologies]);
  const filtered = bedrooms === "all" ? typologies : typologies.filter((t) => t.bedrooms === bedrooms);

  return (
    <>
      <div className="mb-10 flex flex-col items-start justify-between gap-4 rounded-3xl border border-graphite-100 bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-xs font-semibold tracking-[0.2em] text-graphite-400 uppercase">Tipologia</span>
          {(["all", ...options] as const).map((o) => (
            <button
              key={o}
              onClick={() => setBedrooms(o)}
              className={cn("rounded-full px-4 py-2 text-xs font-medium transition-all", bedrooms === o ? "bg-navy-900 text-white shadow-soft" : "bg-graphite-100 text-graphite-600 hover:bg-gold-100 hover:text-navy-900")}
            >
              {o === "all" ? "Todas" : `T${o} · ${o} quartos`}
            </button>
          ))}
        </div>
        <p className="text-xs text-graphite-500">
          {filtered.length} {filtered.length === 1 ? "tipologia" : "tipologias"} · áreas e preços por confirmar
        </p>
      </div>
      <motion.div layout className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((t) => (
            <motion.div key={t.slug} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.4 }}>
              <ApartmentCard typology={t} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
