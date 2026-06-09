import { useMemo, useState } from "react";
import { PenLine, Shuffle, Sprout } from "lucide-react";
import { motion } from "motion/react";
import { PROMPTS, type ReflectionPrompt } from "@/lib/reflection-prompts";
import { ReflectionWriteSheet } from "@/components/home/reflection-write-sheet";
import type { JournalStats } from "@/lib/journal-entries.functions";

interface Props {
  stats: JournalStats;
  wroteToday: boolean;
  onSaved?: () => void;
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pickDailyPrompt(): ReflectionPrompt {
  const pool = PROMPTS.filter((p) => p.family === "universal");
  const day = new Date();
  const seed = day.getFullYear() * 372 + (day.getMonth() + 1) * 31 + day.getDate();
  return pool[seed % pool.length];
}

export function TodayIsland({ stats, wroteToday, onSaved }: Props) {
  const initial = useMemo(() => pickDailyPrompt(), []);
  const [prompt, setPrompt] = useState<ReflectionPrompt>(initial);
  const [open, setOpen] = useState(false);

  const showingUp = useMemo(
    () => new Set([...stats.walkDays, ...stats.entryDays]),
    [stats.walkDays, stats.entryDays],
  );

  const { streak, weekDots } = useMemo(() => {
    let s = 0;
    const cur = new Date();
    cur.setHours(0, 0, 0, 0);
    // start from yesterday if not shown today, so an active streak doesn't break visually
    if (!showingUp.has(isoDay(cur))) cur.setDate(cur.getDate() - 1);
    while (showingUp.has(isoDay(cur))) {
      s += 1;
      cur.setDate(cur.getDate() - 1);
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const dots = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return showingUp.has(isoDay(d));
    });
    return { streak: s, weekDots: dots };
  }, [showingUp]);

  function shuffle() {
    const pool = PROMPTS.filter((p) => p.family === "universal" && p.id !== prompt.id);
    if (pool.length === 0) return;
    setPrompt(pool[Math.floor(Math.random() * pool.length)]);
  }

  const showStreakNudge = streak > 0 && !wroteToday;

  return (
    <>
      <section className="rounded-3xl border border-border bg-card/85 p-4 shadow-soft backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {wroteToday ? "Another for today" : "Today"}
          </div>
          <button
            type="button"
            onClick={shuffle}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] text-foreground/80 hover:bg-muted/70"
            aria-label="Shuffle prompt"
          >
            <Shuffle className="h-3 w-3" /> Shuffle
          </button>
        </div>

        <button type="button" onClick={() => setOpen(true)} className="mt-2 block w-full text-left">
          <p className="font-serif text-[19px] leading-snug text-foreground">{prompt.text}</p>
        </button>

        {/* Streak + week + CTA */}
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <motion.span
              initial={{ rotate: -10, scale: 0.85, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
            >
              <Sprout className="h-4 w-4 text-forest" />
            </motion.span>
            <span className="font-serif text-2xl tabular-nums leading-none">{streak}</span>
            <span className="text-[11px] text-muted-foreground">
              day{streak === 1 ? "" : "s"}
            </span>
            <div className="ml-2 flex gap-1">
              {weekDots.map((on, i) => (
                <span
                  key={i}
                  className={`h-4 w-1.5 rounded-full ${on ? "bg-forest" : "bg-muted"}`}
                  aria-hidden
                />
              ))}
            </div>
          </div>

          <motion.button
            type="button"
            onClick={() => setOpen(true)}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-1.5 rounded-full bg-forest px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow-soft hover:opacity-95"
          >
            <PenLine className="h-3.5 w-3.5" />
            {wroteToday ? "Add more" : "Write"}
          </motion.button>
        </div>

        {showStreakNudge && (
          <p className="mt-2 text-[11px] italic text-muted-foreground">
            Keep your {streak}-day streak — one honest sentence counts.
          </p>
        )}
      </section>

      <ReflectionWriteSheet
        open={open}
        onOpenChange={setOpen}
        prompt={{ id: prompt.id, text: prompt.text }}
        source="home_reflection"
        onSaved={onSaved}
      />
    </>
  );
}
