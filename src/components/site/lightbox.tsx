"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import type { GalleryImage } from "@/types";
import { useLockBody } from "@/hooks/use-lock-body";
import { useHydrated } from "@/hooks/use-hydrated";

export function Lightbox({ images, index, onClose, onChange }: { images: GalleryImage[]; index: number | null; onClose: () => void; onChange: (i: number) => void }) {
  const hydrated = useHydrated();
  const open = index !== null;
  useLockBody(open);

  const go = useCallback((d: number) => index !== null && onChange((index + d + images.length) % images.length), [index, images.length, onChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go, onClose]);

  if (!hydrated) return null;
  const img = index !== null ? images[index] : null;

  return createPortal(
    <AnimatePresence>
      {img && (
        <motion.div className="fixed inset-0 z-[90] flex flex-col bg-navy-950/95 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label={img.title}>
          <div className="flex items-center justify-between px-4 py-4 text-white sm:px-8">
            <div>
              <p className="font-display text-xl">{img.title}</p>
              <p className="text-xs text-white/50">
                {index! + 1} / {images.length}
                {img.detailOf && " · detalhe de fotografia original"}
                {img.credit && ` · ${img.credit}`}
              </p>
            </div>
            <button onClick={onClose} className="rounded-full p-2.5 transition hover:bg-white/10" aria-label="Fechar galeria">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center px-2 sm:px-20">
            <AnimatePresence mode="wait">
              <motion.div
                key={img.id}
                className="relative h-full max-h-[78vh] w-full"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.35 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -60) go(1);
                  if (info.offset.x > 60) go(-1);
                }}
              >
                <Image src={img.src} alt={img.alt} fill sizes="100vw" quality={85} className="object-contain select-none" draggable={false} />
              </motion.div>
            </AnimatePresence>
            <button onClick={() => go(-1)} className="absolute left-2 rounded-full border border-white/20 p-3 text-white transition hover:bg-white hover:text-navy-950 sm:left-6" aria-label="Fotografia anterior">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={() => go(1)} className="absolute right-2 rounded-full border border-white/20 p-3 text-white transition hover:bg-white hover:text-navy-950 sm:right-6" aria-label="Fotografia seguinte">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="scrollbar-thin flex justify-center gap-2 overflow-x-auto px-4 py-4">
            {images.map((im, i) => (
              <button key={im.id} onClick={() => onChange(i)} className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg transition ${i === index ? "ring-2 ring-gold-400" : "opacity-50 hover:opacity-100"}`} aria-label={im.title}>
                <Image src={im.src} alt="" fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
