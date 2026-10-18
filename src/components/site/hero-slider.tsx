"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { heroSlides } from "@/data/gallery";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DURATION = 7000;

export function HeroSlider() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const slide = heroSlides[index];

  const go = useCallback((dir: number) => setIndex((i) => (i + dir + heroSlides.length) % heroSlides.length), []);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => go(1), DURATION);
    return () => clearTimeout(t);
  }, [index, paused, go]);

  return (
    <section className="relative h-[100svh] min-h-[620px] overflow-hidden bg-navy-950" aria-roledescription="carrossel" aria-label="Fotografias do Residencial Laguna">
      <AnimatePresence mode="sync">
        <motion.div key={slide.image} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2, ease: "easeInOut" }}>
          <Image src={slide.image} alt="" fill sizes="100vw" quality={85} className="animate-kenburns object-cover" preload={index === 0} />
        </motion.div>
      </AnimatePresence>

      {/* sobreposições elegantes */}
      <div className="absolute inset-0 bg-gradient-to-r from-navy-950/90 via-navy-950/55 to-navy-950/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-navy-950/80 via-transparent to-navy-950/40" />

      <div className="container-site relative flex h-full flex-col justify-center pt-20">
        <AnimatePresence mode="wait">
          <motion.div key={index} className="max-w-3xl" initial="hidden" animate="show" exit="exit" variants={{ show: { transition: { staggerChildren: 0.12 } } }}>
            <motion.p variants={item} className="eyebrow mb-6 text-gold-300">
              {slide.eyebrow}
            </motion.p>
            <motion.h1 variants={item} className="font-display text-5xl leading-[0.95] font-medium text-white sm:text-7xl lg:text-[5.5rem]">
              {slide.title}
              <span className="mt-2 block text-gold-300 italic">{slide.highlight}</span>
            </motion.h1>
            <motion.p variants={item} className="mt-7 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
              {slide.text}
            </motion.p>
            <motion.div variants={item} className="mt-10 flex flex-wrap gap-3">
              <Link href={slide.cta.href} className={buttonClass("gold", "lg", "group")}>
                {slide.cta.label}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/contactos" className={buttonClass("outline", "lg", "border-white/30 bg-white/5 text-white backdrop-blur hover:border-white hover:bg-white/15")}>
                Contactos
              </Link>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* controlos */}
      <div className="absolute inset-x-0 bottom-0">
        <div className="container-site flex items-end justify-between gap-6 pb-8">
          <div className="flex items-center gap-2 sm:gap-3">
            {heroSlides.map((s, i) => (
              <button key={s.image} onClick={() => setIndex(i)} className="group py-3" aria-label={`Ir para o slide ${i + 1}`} aria-current={i === index}>
                <span className="relative block h-[3px] w-7 overflow-hidden rounded-full bg-white/25 sm:w-16">
                  {i === index && (
                    <motion.span
                      key={`${index}-${paused}`}
                      className="absolute inset-y-0 left-0 bg-gold-400"
                      initial={{ width: paused ? "100%" : "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: paused ? 0 : DURATION / 1000, ease: "linear" }}
                    />
                  )}
                  {i < index && <span className="absolute inset-0 bg-white/60" />}
                </span>
              </button>
            ))}
            <span className="ml-2 hidden font-display text-lg whitespace-nowrap text-white/80 tabular-nums sm:inline">
              {String(index + 1).padStart(2, "0")} <span className="text-white/40">/ {String(heroSlides.length).padStart(2, "0")}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CtrlButton className="hidden sm:flex" onClick={() => setPaused((p) => !p)} label={paused ? "Retomar" : "Pausar"}>
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </CtrlButton>
            <CtrlButton onClick={() => go(-1)} label="Anterior">
              <ChevronLeft className="h-5 w-5" />
            </CtrlButton>
            <CtrlButton onClick={() => go(1)} label="Seguinte">
              <ChevronRight className="h-5 w-5" />
            </CtrlButton>
          </div>
        </div>
      </div>

      <a href="#apresentacao" className="absolute bottom-24 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[10px] tracking-[0.3em] text-white/60 uppercase transition hover:text-white md:flex">
        Descobrir
        <ChevronDown className="h-4 w-4 animate-bounce" />
      </a>
    </section>
  );
}

const item = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.3 } },
};

function CtrlButton({ onClick, label, children, className }: { onClick: () => void; label: string; children: React.ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn("flex h-11 w-11 items-center justify-center rounded-full border border-white/25 text-white backdrop-blur transition-all hover:border-gold-400 hover:bg-gold-400 hover:text-navy-950", className)}
    >
      {children}
    </button>
  );
}
