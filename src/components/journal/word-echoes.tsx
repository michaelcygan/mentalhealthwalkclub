import { useMemo } from "react";
import type { FeedEntry } from "@/lib/journal-entries.functions";
import { computeEchoes } from "@/lib/journal-derive";

interface Props {
  entries: FeedEntry[];
}

export function WordEchoes({ entries }: Props) {
  const words = useMemo(() => computeEchoes(entries, 30, 6), [entries]);
  if (words.length < 4) return null;

  const max = words[0].count;

  return (
    <section>
      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Echoes · last 30 days
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2 rounded-3xl border border-border bg-card p-4 shadow-soft">
        {words.map((w) => {
          const scale = 0.85 + (w.count / max) * 0.7; // 0.85x → 1.55x
          return (
            <span
              key={w.word}
              className="font-serif leading-none text-foreground/90"
              style={{ fontSize: `${scale}rem` }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
        Words showing up most in your reflections.
      </p>
    </section>
  );
}
