import { useMemo, useState } from "react";
import { Share2 } from "lucide-react";
import { motion } from "motion/react";
import type { FeedEntry, JournalStats } from "@/lib/journal-entries.functions";
import { formatDuration } from "@/lib/format-duration";
import { share, haptics } from "@/lib/device";

interface Props {
  stats: JournalStats;
  entries: FeedEntry[];
}

export function ShareMonthCard({ stats, entries }: Props) {
  const [busy, setBusy] = useState(false);

  const summary = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthLabel = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });

    let mins = 0;
    for (const [iso, m] of Object.entries(stats.minutesByDay)) {
      const d = new Date(iso + "T00:00:00");
      if (d >= start && d < end) mins += m;
    }
    let walks = 0;
    const moodAfters: Record<string, number> = {};
    const monthEntries: FeedEntry[] = [];
    let longestReflection = "";
    for (const e of entries) {
      const d = new Date(e.at);
      if (d < start || d >= end) continue;
      monthEntries.push(e);
      if (e.kind === "walk") {
        walks += 1;
        if (e.mood_after) moodAfters[e.mood_after] = (moodAfters[e.mood_after] ?? 0) + 1;
      } else if (e.kind === "reflection" && e.body && e.body.length > longestReflection.length) {
        longestReflection = e.body;
      }
    }
    const topMood =
      Object.keys(moodAfters).length > 0
        ? Object.entries(moodAfters).sort((a, b) => b[1] - a[1])[0][0]
        : null;
    const quote = longestReflection.trim().slice(0, 140);
    const days = new Set<string>();
    for (const e of monthEntries) {
      const d = new Date(e.at);
      days.add(d.toDateString());
    }
    return { monthLabel, mins, walks, topMood, quote, activeDays: days.size };
  }, [stats.minutesByDay, entries]);

  const fmt = formatDuration(summary.mins);

  async function onShare() {
    haptics.tap();
    setBusy(true);
    try {
      const lines = [
        `🌿 ${summary.monthLabel} — my walking month`,
        ``,
        `${summary.walks} walks · ${fmt.value} ${fmt.unit} · ${summary.activeDays} active days`,
        summary.topMood ? `Most felt: ${summary.topMood}` : null,
        summary.quote ? `\n"${summary.quote}${summary.quote.length === 140 ? "…" : ""}"` : null,
        ``,
        `— from my walking journal`,
      ]
        .filter(Boolean)
        .join("\n");
      await share({ title: `${summary.monthLabel} — my walking month`, text: lines });
    } finally {
      setBusy(false);
    }
  }

  const empty = summary.walks === 0 && summary.mins === 0;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-forest/15 via-card to-clay/10 p-5 shadow-soft">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Share my month
      </div>
      <div className="mt-2 font-serif text-2xl leading-tight">{summary.monthLabel}</div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <div className="font-serif text-2xl tabular-nums leading-none">{summary.walks}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">walks</div>
        </div>
        <div>
          <div className="font-serif text-2xl tabular-nums leading-none">{fmt.value}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{fmt.unit}</div>
        </div>
        <div>
          <div className="font-serif text-2xl tabular-nums leading-none">{summary.activeDays}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">days</div>
        </div>
      </div>

      {summary.quote && (
        <p className="mt-3 font-serif italic leading-snug text-foreground/85">
          "{summary.quote}{summary.quote.length === 140 ? "…" : ""}"
        </p>
      )}

      <motion.button
        type="button"
        whileTap={{ scale: 0.96 }}
        disabled={busy || empty}
        onClick={onShare}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-2.5 text-sm font-medium text-background disabled:opacity-50"
      >
        <Share2 className="h-3.5 w-3.5" />
        {empty ? "Walk a bit first" : busy ? "Opening…" : "Share this month"}
      </motion.button>
    </section>
  );
}
