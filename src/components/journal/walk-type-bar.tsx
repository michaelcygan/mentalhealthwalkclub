import { useMemo } from "react";
import type { FeedEntry } from "@/lib/journal-entries.functions";

const TYPE_TONE: Record<string, string> = {
  solo: "bg-forest",
  social: "bg-clay",
  phone: "bg-amber-500",
  group: "bg-indigo-400",
};

function toneFor(t: string) {
  return TYPE_TONE[t] ?? "bg-muted-foreground";
}

function labelFor(t: string) {
  if (!t) return "other";
  return t.replace(/_/g, " ");
}

export function WalkTypeBar({ entries }: { entries: FeedEntry[] }) {
  const segments = useMemo(() => {
    const counts = new Map<string, number>();
    let total = 0;
    for (const e of entries) {
      if (e.kind !== "walk") continue;
      const t = (e.walk_type ?? "other").toLowerCase();
      counts.set(t, (counts.get(t) ?? 0) + 1);
      total += 1;
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    return { sorted, total };
  }, [entries]);

  if (segments.total === 0) return null;

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          How you walk
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {segments.total} walk{segments.total === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {segments.sorted.map(([t, n]) => (
          <div
            key={t}
            className={`${toneFor(t)} h-full transition-all`}
            style={{ width: `${(n / segments.total) * 100}%` }}
            title={`${labelFor(t)} · ${n}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {segments.sorted.slice(0, 4).map(([t, n]) => {
          const pct = Math.round((n / segments.total) * 100);
          return (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${toneFor(t)}`} />
              <span className="capitalize">{labelFor(t)}</span>
              <span className="tabular-nums text-foreground/70">{pct}%</span>
            </span>
          );
        })}
      </div>
    </section>
  );
}
