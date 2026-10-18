"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Expand } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import type { GalleryImage } from "@/types";
import { galleryCategories } from "@/data/gallery";
import { cn } from "@/lib/utils";
import { Lightbox } from "./lightbox";

export function GalleryGrid({ images, filterable = true }: { images: GalleryImage[]; filterable?: boolean }) {
  const [category, setCategory] = useState<(typeof galleryCategories)[number]["id"]>("todas");
  const [open, setOpen] = useState<number | null>(null);
  const filtered = useMemo(() => (category === "todas" ? images : images.filter((i) => i.category === category)), [images, category]);

  return (
    <>
      {filterable && (
        <div className="mb-10 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Categorias da galeria">
          {galleryCategories.map((c) => {
            const count = c.id === "todas" ? images.length : images.filter((i) => i.category === c.id).length;
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={category === c.id}
                onClick={() => setCategory(c.id)}
                className={cn(
                  "rounded-full border px-4 py-2 text-xs font-medium tracking-wide transition-all",
                  category === c.id ? "border-navy-900 bg-navy-900 text-white shadow-soft" : "border-graphite-200 text-graphite-600 hover:border-gold-400 hover:text-navy-900",
                )}
              >
                {c.label} <span className="ml-1 opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      <motion.div layout className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((img, i) => (
            <motion.button
              layout
              key={img.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.4, delay: i * 0.03 }}
              onClick={() => setOpen(i)}
              className="group relative mb-4 block w-full overflow-hidden rounded-2xl bg-graphite-100 text-left break-inside-avoid"
              aria-label={`Ampliar: ${img.title}`}
            >
              <Image src={img.src} alt={img.alt} width={img.width} height={img.height} sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="h-auto w-full transition-transform duration-700 ease-out group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-950/80 via-navy-950/0 to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-gold-300 uppercase">{galleryCategories.find((c) => c.id === img.category)?.label}</p>
                  <p className="font-display text-xl text-white">{img.title}</p>
                </div>
                <span className="flex h-9 w-9 translate-y-2 items-center justify-center rounded-full bg-white/15 text-white opacity-0 backdrop-blur transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                  <Expand className="h-4 w-4" />
                </span>
              </div>
            </motion.button>
          ))}
        </AnimatePresence>
      </motion.div>

      <Lightbox images={filtered} index={open} onClose={() => setOpen(null)} onChange={setOpen} />
    </>
  );
}
