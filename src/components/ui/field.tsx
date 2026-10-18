import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-xl border bg-white px-3.5 text-sm text-graphite-900 placeholder:text-graphite-400 transition focus:outline-none focus:ring-4 disabled:bg-graphite-50 disabled:text-graphite-500";
const ok = "border-graphite-200 focus:border-navy-400 focus:ring-navy-100";
const bad = "border-red-300 focus:border-red-400 focus:ring-red-100";

export function Field({
  label,
  error,
  hint,
  required,
  children,
  className,
  htmlFor,
}: {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-xs font-medium text-graphite-700">
          {label}
          {required && <span className="ml-0.5 text-gold-600">*</span>}
        </label>
      )}
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : hint ? <p className="text-xs text-graphite-500">{hint}</p> : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, invalid, ...props }, ref) {
  return <input ref={ref} className={cn(base, "h-10", invalid ? bad : ok, className)} {...props} />;
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(base, "h-10 appearance-none pr-9", invalid ? bad : ok, className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-graphite-400" />
    </div>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, invalid, ...props }, ref) {
  return <textarea ref={ref} className={cn(base, "min-h-24 py-2.5", invalid ? bad : ok, className)} {...props} />;
});
