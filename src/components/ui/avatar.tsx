import { cn, initials } from "@/lib/utils";

const palettes = ["from-navy-700 to-navy-900", "from-gold-500 to-gold-700", "from-teal-600 to-teal-800", "from-violet-600 to-violet-800", "from-graphite-600 to-graphite-800"];

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % palettes.length;
  const sz = { sm: "h-8 w-8 text-[11px]", md: "h-10 w-10 text-xs", lg: "h-14 w-14 text-base", xl: "h-20 w-20 text-xl" }[size];
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ring-2 ring-white", palettes[idx], sz, className)} aria-hidden>
      {initials(name)}
    </span>
  );
}
