import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export function Logo({ variant = "color", className, href = "/" }: { variant?: "color" | "white"; className?: string; href?: string | null }) {
  const img = (
    <Image
      src={variant === "white" ? siteConfig.logo.white : siteConfig.logo.color}
      alt="Residencial Laguna"
      width={siteConfig.logo.width}
      height={siteConfig.logo.height}
      className={cn("h-9 w-auto", className)}
      preload
    />
  );
  if (!href) return img;
  return (
    <Link href={href} aria-label="Residencial Laguna — Início" className="inline-flex shrink-0">
      {img}
    </Link>
  );
}
