import { cn } from "@/lib/utils";

export function IconBtn({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className={cn("rounded-lg p-2 text-graphite-500 transition", danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-navy-50 hover:text-navy-900")}>
      {children}
    </button>
  );
}
