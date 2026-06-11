import { cn } from "@/lib/utils";

/**
 * Lofi loading surface — a calm, sweeping highlight instead of the
 * pulsing opacity that ships with `animate-pulse`. Honors prefers-reduced-motion.
 */
export function Shimmer({
  className,
  rounded = "rounded-2xl",
}: {
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden bg-muted/45",
        rounded,
        className,
      )}
    >
      <div className="absolute inset-0 shimmer-sweep" />
    </div>
  );
}
