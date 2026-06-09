import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion, useReducedMotion } from "motion/react";
import { Pencil, Target } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getUserGoal, setUserGoal, type GoalKind, type UserGoal } from "@/lib/user-goals.functions";
import type { JournalStats } from "@/lib/journal-entries.functions";
import { haptics } from "@/lib/device";

interface Props {
  stats: JournalStats;
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function WeeklyGoalRing({ stats }: Props) {
  const fetchGoal = useServerFn(getUserGoal);
  const saveGoal = useServerFn(setUserGoal);
  const reduce = useReducedMotion();

  const [goal, setGoal] = useState<UserGoal | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const g = await fetchGoal();
        setGoal(g);
      } finally {
        setLoaded(true);
      }
    })();
  }, [fetchGoal]);

  const week = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return isoDay(d);
    });
    let mins = 0;
    const walkSet = new Set(stats.walkDays);
    let walks = 0;
    for (const iso of days) {
      mins += stats.minutesByDay[iso] ?? 0;
      if (walkSet.has(iso)) walks += 1;
    }
    const today = new Date();
    const daysLeft = Math.max(0, 7 - ((today.getDay() + 6) % 7) - 1);
    return { walks, mins, daysLeft };
  }, [stats]);

  const effective = goal ?? { kind: "walks_per_week" as GoalKind, target: 3, updated_at: "" };
  const current = effective.kind === "walks_per_week" ? week.walks : week.mins;
  const progress = Math.min(1, current / Math.max(1, effective.target));
  const hit = current >= effective.target;

  async function persist(kind: GoalKind, target: number) {
    haptics.tap();
    const optimistic = { kind, target, updated_at: new Date().toISOString() };
    setGoal(optimistic);
    try {
      const saved = await saveGoal({ data: { kind, target } });
      setGoal(saved);
      toast.success("Goal set");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save goal");
    }
  }

  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  const unitLabel = effective.kind === "walks_per_week" ? "walks" : "min";
  const subline = hit
    ? "You showed up. Goal met."
    : week.daysLeft === 0
    ? "Last day — one walk closes it."
    : `${week.daysLeft} day${week.daysLeft === 1 ? "" : "s"} left this week`;

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-soft">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            <Target className="h-3 w-3" /> Weekly goal
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] text-foreground/80 hover:bg-muted/70"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        </div>

        <div className="mt-3 flex items-center gap-4">
          <div className="relative h-32 w-32 shrink-0">
            <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="color-mix(in oklab, var(--forest) 12%, transparent)"
                strokeWidth="10"
              />
              <motion.circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="var(--forest)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={reduce ? false : { strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <div className="font-serif text-3xl tabular-nums leading-none text-foreground">
                {current}
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                of {effective.target} {unitLabel}
              </div>
            </div>
            {hit && (
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 360, damping: 18, delay: 0.2 }}
                className="absolute -right-1 -top-1 rounded-full bg-forest px-2 py-0.5 text-[10px] font-medium text-primary-foreground shadow-soft"
              >
                ✓ Met
              </motion.div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-serif text-base leading-snug text-foreground">{subline}</p>
            {!loaded ? (
              <p className="mt-1 text-[11px] text-muted-foreground">Loading your goal…</p>
            ) : !goal ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Default: 3 walks/week. Tap edit to set your own.
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {Math.round(progress * 100)}% there
                {!hit && effective.kind === "walks_per_week" && week.walks < effective.target
                  ? ` · ${effective.target - week.walks} more`
                  : ""}
              </p>
            )}
          </div>
        </div>
      </section>

      <GoalEditSheet
        open={open}
        onOpenChange={setOpen}
        initial={effective}
        onSave={persist}
      />
    </>
  );
}

function GoalEditSheet({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: { kind: GoalKind; target: number };
  onSave: (kind: GoalKind, target: number) => Promise<void>;
}) {
  const [kind, setKind] = useState<GoalKind>(initial.kind);
  const [target, setTarget] = useState<number>(initial.target);

  useEffect(() => {
    if (open) {
      setKind(initial.kind);
      setTarget(initial.target);
    }
  }, [open, initial.kind, initial.target]);

  const presets = kind === "walks_per_week" ? [2, 3, 4, 5] : [60, 90, 120, 180];
  const unit = kind === "walks_per_week" ? "walks/week" : "min/week";
  const min = kind === "walks_per_week" ? 1 : 30;
  const max = kind === "walks_per_week" ? 7 : 600;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">Your weekly goal</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="inline-flex rounded-full border border-border bg-background p-0.5 text-xs">
            {(["walks_per_week", "minutes_per_week"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k);
                  setTarget(k === "walks_per_week" ? 3 : 90);
                }}
                className={`rounded-full px-3 py-1 transition ${
                  kind === k ? "bg-forest text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {k === "walks_per_week" ? "Walks" : "Minutes"}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setTarget(p)}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  target === p
                    ? "border-forest bg-forest text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-forest/40"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <label className="block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Custom target ({unit})
            <input
              type="number"
              min={min}
              max={max}
              value={target}
              onChange={(e) => setTarget(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
              className="mt-1.5 w-full rounded-2xl border border-border bg-background px-3 py-2 text-base focus:border-forest focus:outline-none"
            />
          </label>

          <button
            type="button"
            onClick={() => void onSave(kind, target)}
            className="w-full rounded-full bg-forest py-3 font-medium text-primary-foreground hover:opacity-95"
          >
            Save goal
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
