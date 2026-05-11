/**
 * Always-on stat shelf: miles · steps · pace. Equal width, fixed (no rotation).
 */
import type { ReactNode } from "react";

interface Props {
  miles: number;
  steps: number;
  paceMinPerMi: number;
  cadence: number;
  /** Optional small hint rendered under the steps cell (e.g. enable motion). */
  stepsHint?: ReactNode;
}

export function WalkStatTrio({ miles, steps, paceMinPerMi, cadence, stepsHint }: Props) {
  const paceStr =
    paceMinPerMi > 0 && paceMinPerMi < 60
      ? `${Math.floor(paceMinPerMi)}'${String(Math.round((paceMinPerMi % 1) * 60)).padStart(2, "0")}"`
      : "—";
  const stats = [
    { key: "miles", label: "miles", value: miles.toFixed(2), title: "miles", hint: null as ReactNode },
    { key: "steps", label: "steps", value: steps.toLocaleString(), title: "steps", hint: stepsHint ?? null },
    {
      key: "pace",
      label: "pace",
      value: paceStr,
      title: cadence > 0 ? `pace · cadence ${cadence}/min` : "pace (min/mi)",
      hint: null as ReactNode,
    },
  ] as const;
  return (
    <div className="mx-4 mt-3 grid grid-cols-3 overflow-hidden rounded-2xl border border-border bg-card text-center md:mx-0">
      {stats.map((s, i) => (
        <div
          key={s.key}
          title={s.title}
          className={`px-3 py-3 ${i > 0 ? "border-l border-border" : ""}`}
        >
          <div className="font-serif text-2xl tabular-nums leading-none">{s.value}</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {s.label}
          </div>
          {s.hint && <div className="mt-1.5 text-[10px] leading-tight">{s.hint}</div>}
        </div>
      ))}
    </div>
  );
}
