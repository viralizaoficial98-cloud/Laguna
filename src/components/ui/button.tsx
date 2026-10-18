import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "gold" | "outline" | "ghost" | "danger" | "white" | "subtle";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-navy-900 text-white hover:bg-navy-800 shadow-soft hover:shadow-lift",
  gold: "bg-gradient-to-br from-gold-400 to-gold-600 text-navy-950 hover:shadow-gold hover:brightness-105",
  outline: "border border-graphite-200 bg-white text-navy-900 hover:border-navy-300 hover:bg-navy-50",
  ghost: "text-graphite-600 hover:bg-graphite-100 hover:text-navy-900",
  danger: "bg-red-600 text-white hover:bg-red-700",
  white: "bg-white text-navy-900 hover:bg-gold-50 shadow-soft",
  subtle: "bg-navy-50 text-navy-800 hover:bg-navy-100",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-sm gap-2.5 rounded-xl tracking-wide",
  icon: "h-9 w-9 rounded-xl",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-all duration-300 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
    variants[variant],
    sizes[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});
