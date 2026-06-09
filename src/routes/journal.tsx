import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { BookHeart, PenLine } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { Button } from "@/components/ui/button";
import { TrackingModule } from "@/components/journal/tracking-module";
import { TodayIsland } from "@/components/journal/today-island";
import { JournalSegmented, type JournalSegment } from "@/components/journal/journal-segmented";
import { OnThisDayRail } from "@/components/journal/on-this-day-rail";
import { MoodPulseMini } from "@/components/journal/mood-pulse-mini";
import { InsightsStrip } from "@/components/journal/insights-strip";
import { PromptChipsRow } from "@/components/journal/prompt-chips-row";
import { TodayPromptCard } from "@/components/journal/today-prompt-card";
import { MemoriesGrid } from "@/components/journal/memories-grid";
import { StatsPanel } from "@/components/journal/stats-panel";
import { EntriesFeed } from "@/components/journal/entries-feed";
import { ReflectionWriteSheet } from "@/components/home/reflection-write-sheet";
import {
  getJournalStats,
  listJournalFeed,
  type FeedEntry,
  type JournalStats,
} from "@/lib/journal-entries.functions";

export const Route = createFileRoute("/journal")({
  component: JournalTab,
  head: () => ({ meta: [{ title: "Journal — Mental Health Walk Club" }] }),
});

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function JournalTab() {
  const { user } = useAuth();
  const { openAuth } = useAuthPrompt();
  const fetchFeed = useServerFn(listJournalFeed);
  const fetchStats = useServerFn(getJournalStats);

  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [stats, setStats] = useState<JournalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [writeOpen, setWriteOpen] = useState(false);
  const [segment, setSegment] = useState<JournalSegment>("for-you");

  const reload = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [feed, s] = await Promise.all([
        fetchFeed({ data: { limit: 100 } }),
        fetchStats(),
      ]);
      setEntries(feed ?? []);
      setStats(s);
    } finally {
      setLoading(false);
    }
  }, [user, fetchFeed, fetchStats]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const wroteToday = useMemo(() => {
    if (!stats) return false;
    const today = isoDay(new Date());
    return stats.entryDays.includes(today);
  }, [stats]);

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-5 py-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent">
          <BookHeart className="h-6 w-6 text-forest" />
        </div>
        <h1 className="font-serif text-3xl">Your journal lives here</h1>
        <p className="text-muted-foreground">Walks, moods, reflections — all private to you.</p>
        <Button
          onClick={() => openAuth("signup")}
          className="rounded-full bg-forest text-primary-foreground hover:opacity-90"
        >
          Create your account
        </Button>
      </div>
    );
  }

  if (loading || !stats) {
    return (
      <div className="space-y-3">
        <div className="h-32 animate-pulse rounded-3xl bg-secondary/60" />
        <div className="h-24 animate-pulse rounded-3xl bg-secondary/60" />
        <div className="h-64 animate-pulse rounded-3xl bg-secondary/60" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      <header className="flex items-center justify-between gap-3 pt-1">
        <h1 className="font-serif text-3xl leading-tight">Journal</h1>
        <motion.button
          type="button"
          onClick={() => setWriteOpen(true)}
          whileTap={{ scale: 0.95 }}
          className="inline-flex items-center gap-1.5 rounded-full bg-forest px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow-soft hover:opacity-95"
        >
          <PenLine className="h-3.5 w-3.5" />
          Write
        </motion.button>
      </header>

      <TodayIsland stats={stats} wroteToday={wroteToday} onSaved={() => void reload()} />

      <JournalSegmented value={segment} onChange={setSegment} />

      {segment === "for-you" && (
        <div className="space-y-6">
          <OnThisDayRail entries={entries} />
          <MoodPulseMini stats={stats} />
          <InsightsStrip stats={stats} entries={entries} />
          <PromptChipsRow onSaved={() => void reload()} />
        </div>
      )}

      {segment === "reflect" && (
        <div className="space-y-6">
          <TodayPromptCard wroteToday={wroteToday} onSaved={() => void reload()} />
          <PromptChipsRow onSaved={() => void reload()} eyebrow="More prompts" count={8} />
          <PromptChipsRow onSaved={() => void reload()} family="tender" eyebrow="When it's tender" />
          <PromptChipsRow onSaved={() => void reload()} family="light" eyebrow="When it feels light" />
        </div>
      )}

      {segment === "stats" && (
        <div className="space-y-6">
          <TrackingModule stats={stats} />
          <InsightsStrip stats={stats} entries={entries} />
          <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
            <StatsPanel stats={stats} />
          </div>
        </div>
      )}

      {segment === "entries" && (
        <EntriesFeed
          entries={entries}
          onChanged={() => void reload()}
          onWrite={() => setWriteOpen(true)}
        />
      )}

      {segment === "memories" && (
        <div className="space-y-6">
          <OnThisDayRail entries={entries} />
          <MemoriesGrid entries={entries} />
        </div>
      )}

      <p className="pt-2 text-center font-serif text-xs italic text-muted-foreground">
        Still here. Still walking.{" "}
        <Link to="/" className="underline-offset-2 hover:underline">Home</Link>
      </p>

      <ReflectionWriteSheet
        open={writeOpen}
        onOpenChange={setWriteOpen}
        prompt={null}
        source="journal_freeform"
        onSaved={() => void reload()}
      />
    </div>
  );
}
