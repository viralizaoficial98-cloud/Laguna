import type { ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon = Inbox, title, description, action }: { icon?: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-50 text-navy-600">
        <Icon className="h-6 w-6" />
      </div>
      <p className="font-medium text-navy-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-graphite-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
