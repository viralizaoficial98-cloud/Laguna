"use client";

import { motion } from "framer-motion";

/** Transição suave entre páginas do portal público. */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
