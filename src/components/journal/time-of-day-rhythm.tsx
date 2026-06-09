import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Clock } from "lucide-react";
import type { FeedEntry } from "@/lib/journal-entries.functions";

const BUCKETS: { label: string; range: string; start: number; end: number }[] = [
  { label: "Early", range: "5–8", start: 5, end: 8 },
  { label: "Morning", range: "8–12", start: 8, end: 12 },
  { label: "Afternoon", range: "12–17", start: 12, end: 17 },
  { label: "Evening", range: "17–22", start: 17, end: 22 },
];

export function TimeOfDayRhythm({ entries }: { entries: FeedEntry[] }) {
  const reduce = useReducedMotion();

  const counts = useMemo(() => {
    const out = new Array(BUCKETS.length).fill(0) as number[];
    for (const e of entries) {
      if (e.kind !== "walk") continue;
      const h = new Date(e.at).getHours();
      const idx = BUCKETS.findIndex((b) => h >= b.start && h < b.end);
      if (idx >= 0) out[idx] += 1;
    }
    return out;
  }, [entries]);

  const max = Math.max(1, ...counts);
  const total = counts.reduce((s, n) => s + n, 0);
  const peakIdx = total > 0 ? counts.indexOf(Math.max(...counts)) : -1;

  if (total === 0) {
    return (
      <section className="rounded-3xl border border-dashed border-border bg-card/60 p-4 text-center text-xs text-muted-foreground">
        Log a few walks to see your time-of-day rhythm.
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <Clock className="h-3 w-3" /> When you walk
        </div>
        {peakIdx >= 0 && (
          <div className="text-[11px] text-muted-foreground">
            Your hour · <span className="text-foreground">{BUCKETS[peakIdx].label.toLowerCase()}</span>
          </div>
        )}
      </div>
      <div className="mt-3 grid grid-cols-4 items-end gap-2 h-24">
        {counts.map((c, i) => {
          const h = (c / max) * 100;
          const isPeak = i === peakIdx;
          return (
            <div key={i} className="flex h-full flex-col items-center justify-end gap-1.5">
              <div className="relative flex h-full w-full items-end">
                <motion.div
                  initial={reduce ? false : { height: 0 }}
                  animate={{ height: `${Math.max(6, h)}%` }}
                  transition={{ duration: 0.6, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  className={`w-full rounded-t-md ${
                    isPeak ? "bg-forest shadow-[0_0_18px_-2px_color-mix(in_oklab,var(--forest)_60%,transparent)]" : "bg-muted"
                  }`}
                />
              </div>
              <div className="text-[10px] tabular-nums text-foreground">{c}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 grid grid-cols-4 gap-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
        {BUCKETS.map((b) => (
          <div key={b.label}>{b.label}</div>
        ))}
      </div>
    </section>
  );
}
