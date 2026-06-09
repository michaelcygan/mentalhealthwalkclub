import { useMemo } from "react";
import { motion } from "motion/react";
import { Cloud, CloudRain, Sun, Sparkles } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { ReflectionWriteSheet } from "@/components/home/reflection-write-sheet";
import { useState } from "react";
import { PROMPTS } from "@/lib/reflection-prompts";
import type { FeedEntry, JournalStats } from "@/lib/journal-entries.functions";
import {
  firstName,
  greetingForHour,
  readLast7,
  todaySeed,
} from "@/lib/journal-derive";

interface Props {
  user: User | null;
  stats: JournalStats;
  entries: FeedEntry[];
  onSaved?: () => void;
}

export function DailyCompass({ user, stats, entries, onSaved }: Props) {
  const [open, setOpen] = useState(false);

  const read = useMemo(() => readLast7(stats, entries), [stats, entries]);
  const name = useMemo(
    () => firstName(user?.user_metadata as Record<string, unknown> | undefined, user?.email),
    [user],
  );
  const greeting = useMemo(() => greetingForHour(), []);

  const prompt = useMemo(() => {
    const pool = PROMPTS.filter((p) => p.family === read.family);
    const fallback = PROMPTS.filter((p) => p.family === "universal");
    const list = pool.length > 0 ? pool : fallback;
    return list[todaySeed() % Math.max(1, list.length)] ?? null;
  }, [read.family]);

  const ToneIcon =
    read.tone === "up"
      ? Sun
      : read.tone === "down"
        ? CloudRain
        : read.tone === "quiet"
          ? Sparkles
          : Cloud;

  const toneClass =
    read.tone === "up"
      ? "text-forest"
      : read.tone === "down"
        ? "text-clay"
        : "text-muted-foreground";

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.99 }}
        className="block w-full overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-accent/40 p-4 text-left shadow-soft"
      >
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {greeting}
            {name ? `, ${name}` : ""}
          </div>
          <span
            className={`inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.12em] ${toneClass}`}
          >
            <ToneIcon className="h-3.5 w-3.5" />
            {read.tone === "up"
              ? "Brighter"
              : read.tone === "down"
                ? "Heavier"
                : read.tone === "quiet"
                  ? "Quiet"
                  : "Steady"}
          </span>
        </div>
        <p className="mt-2 font-serif text-lg leading-snug text-foreground">{read.headline}</p>
        {prompt && (
          <p className="mt-3 line-clamp-2 font-serif text-sm italic text-muted-foreground">
            “{prompt.text}”
          </p>
        )}
        <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-forest">
          Tap to reflect
          <span aria-hidden>→</span>
        </div>
      </motion.button>
      <ReflectionWriteSheet
        open={open}
        onOpenChange={setOpen}
        prompt={prompt ? { id: prompt.id, text: prompt.text } : null}
        source="journal_freeform"
        onSaved={() => {
          setOpen(false);
          onSaved?.();
        }}
      />
    </>
  );
}
