/**
 * Always-on stat shelf: miles · steps · pace. Equal width, fixed (no rotation).
 */
interface Props {
  miles: number;
  steps: number;
  paceMinPerMi: number;
  cadence: number;
}

export function WalkStatTrio({ miles, steps, paceMinPerMi, cadence }: Props) {
  const paceStr =
    paceMinPerMi > 0 && paceMinPerMi < 60
      ? `${Math.floor(paceMinPerMi)}'${String(Math.round((paceMinPerMi % 1) * 60)).padStart(2, "0")}"`
      : "—";
  const stats = [
    { label: "miles", value: miles.toFixed(2), title: "miles" },
    { label: "steps", value: steps.toLocaleString(), title: "steps" },
    {
      label: "pace",
      value: paceStr,
      title: cadence > 0 ? `pace · cadence ${cadence}/min` : "pace (min/mi)",
    },
  ] as const;
  return (
    <div className="mx-4 mt-3 grid grid-cols-3 overflow-hidden rounded-2xl border border-border bg-card text-center md:mx-0">
      {stats.map((s, i) => (
        <div
          key={s.label}
          title={s.title}
          className={`px-3 py-3 ${i > 0 ? "border-l border-border" : ""}`}
        >
          <div className="font-serif text-2xl tabular-nums leading-none">{s.value}</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}
