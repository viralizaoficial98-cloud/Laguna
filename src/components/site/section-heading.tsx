import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  light,
  action,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  light?: boolean;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Reveal className={cn("mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between", align === "center" && "items-center text-center md:flex-col md:items-center", className)}>
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow && <p className={cn("eyebrow mb-4", align === "center" && "justify-center", light && "text-gold-300")}>{eyebrow}</p>}
        <h2 className={cn("font-display text-4xl leading-[1.05] font-medium sm:text-5xl", light ? "text-white" : "text-navy-900")}>{title}</h2>
        {description && <p className={cn("mt-5 text-base leading-relaxed", light ? "text-navy-100/80" : "text-graphite-500")}>{description}</p>}
      </div>
      {action}
    </Reveal>
  );
}
