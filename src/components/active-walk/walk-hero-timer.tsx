/**
 * Hero band: just the timer + GPS status. Nothing else competes for the eye.
 */
export type GpsState = "idle" | "live" | "weak" | "denied";

interface Props {
  elapsed: number;
  paused: boolean;
  gps: GpsState;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function WalkHeroTimer({ elapsed, paused, gps }: Props) {
  const dot =
    gps === "live" ? "bg-forest" : gps === "weak" ? "bg-amber-400" : "bg-muted-foreground/40";
  const label =
    gps === "live" ? "GPS live" : gps === "weak" ? "GPS searching" : gps === "denied" ? "GPS off" : "GPS waking";

  return (
    <section className="relative mx-4 mt-3 overflow-hidden rounded-3xl gradient-forest px-5 py-9 text-primary-foreground shadow-elevated md:mx-0">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.08),_transparent_60%)]" />
      <div className="relative text-center">
        <div
          aria-live="off"
          className={`font-serif text-7xl tabular-nums tracking-tight ${paused ? "" : "breathe"}`}
        >
          {fmt(elapsed)}
        </div>
        <div className="mt-2 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.22em] opacity-80">
          <span>{paused ? "paused" : "elapsed"}</span>
          <span aria-hidden className="opacity-50">·</span>
          <span className="inline-flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${dot} ${gps === "live" ? "animate-pulse" : ""}`} />
            {label}
          </span>
        </div>
      </div>
    </section>
  );
}
