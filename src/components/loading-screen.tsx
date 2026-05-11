/**
 * App-wide loading state. One source of truth for the breathing logo + caption.
 * Honors `prefers-reduced-motion` via the keyframe rule in styles.css.
 */
interface Props {
  /** "screen" (default) fills the viewport. "inline" fills its parent. */
  variant?: "screen" | "inline";
  /** Visible status text under the mark. Default "Loading…". Pass null to hide. */
  label?: string | null;
  /** Logo size in tailwind units. Default 40 (h-40 w-40). */
  size?: 24 | 32 | 40;
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<Props["size"]>, string> = {
  24: "h-24 w-24",
  32: "h-32 w-32",
  40: "h-40 w-40",
};

export function LoadingScreen({
  variant = "screen",
  label = "Loading…",
  size = 40,
  className = "",
}: Props) {
  const wrapper =
    variant === "screen"
      ? "flex min-h-screen items-center justify-center bg-background"
      : "flex w-full items-center justify-center py-16";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading"}
      className={`${wrapper} ${className}`}
    >
      <div className="flex flex-col items-center gap-5">
        <img
          src="/logo-stamp.png"
          alt=""
          aria-hidden="true"
          draggable={false}
          className={`${SIZE_CLASS[size]} animate-[loader-breathe_2.4s_ease-in-out_infinite] select-none`}
        />
        {label ? (
          <span className="animate-pulse text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}
