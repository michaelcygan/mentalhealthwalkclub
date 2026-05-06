import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, body, action }: { icon?: LucideIcon; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-secondary/30 p-8 text-center">
      {Icon && (
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent">
          <Icon className="h-5 w-5 text-forest" />
        </div>
      )}
      <div className="font-serif text-lg leading-tight">{title}</div>
      {body && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action}
    </div>
  );
}
