"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useLockBody } from "@/hooks/use-lock-body";
import { useHydrated } from "@/hooks/use-hydrated";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const hydrated = useHydrated();
  useLockBody(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!hydrated) return null;
  const width = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" }[size];

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
          <motion.div className="absolute inset-0 bg-navy-950/55 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.98 }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}
            className={cn("relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-lift sm:rounded-3xl", width)}
          >
            {(title || description) && (
              <div className="flex items-start justify-between gap-4 border-b border-graphite-100 px-6 pt-5 pb-4">
                <div>
                  {title && <h2 className="font-display text-2xl font-semibold text-navy-900">{title}</h2>}
                  {description && <p className="mt-1 text-sm text-graphite-500">{description}</p>}
                </div>
                <button onClick={onClose} className="rounded-lg p-1.5 text-graphite-400 transition hover:bg-graphite-100 hover:text-navy-900" aria-label="Fechar">
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-graphite-100 bg-graphite-50/60 px-6 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
