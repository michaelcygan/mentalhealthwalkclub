import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Quiet empty-state card. Serif italic line of voice + optional icon + optional action.
 * Use whenever a list returns zero items, instead of leaving raw blank space.
 */
export function EmptyNote({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border bg-card/60 px-6 py-7 text-center",
        className,
      )}
    >
      {icon && (
        <div className="grid h-10 w-10 place-items-center rounded-full bg-accent/60 text-forest">
          {icon}
        </div>
      )}
      <p className="font-serif text-base italic text-foreground">{title}</p>
      {hint && <p className="max-w-xs text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
