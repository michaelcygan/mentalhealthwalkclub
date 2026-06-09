import { useMemo, useState } from "react";
import { PenLine, Shuffle } from "lucide-react";
import { PROMPTS, type ReflectionPrompt } from "@/lib/reflection-prompts";
import { ReflectionWriteSheet } from "@/components/home/reflection-write-sheet";

interface Props {
  /** Whether the user already wrote today — changes the CTA label. */
  wroteToday: boolean;
  onSaved?: () => void;
}

function pickDailyPrompt(): ReflectionPrompt {
  const pool = PROMPTS.filter((p) => p.family === "universal");
  // Stable per-day seed
  const day = new Date();
  const seed = day.getFullYear() * 372 + (day.getMonth() + 1) * 31 + day.getDate();
  return pool[seed % pool.length];
}

export function TodayPromptCard({ wroteToday, onSaved }: Props) {
  const initial = useMemo(() => pickDailyPrompt(), []);
  const [prompt, setPrompt] = useState<ReflectionPrompt>(initial);
  const [open, setOpen] = useState(false);

  function shuffle() {
    const pool = PROMPTS.filter((p) => p.family === "universal" && p.id !== prompt.id);
    if (pool.length === 0) return;
    setPrompt(pool[Math.floor(Math.random() * pool.length)]);
  }

  return (
    <>
      <section className="rounded-3xl border border-border bg-card/80 p-5 shadow-soft backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {wroteToday ? "Another for today" : "Today’s reflection"}
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
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 block w-full text-left"
        >
          <p className="font-serif text-xl leading-snug text-foreground">{prompt.text}</p>
        </button>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[11px] italic text-muted-foreground">
            {wroteToday ? "Streak alive. Add more if it’s asking to come out." : "A few honest sentences. That’s enough."}
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            <PenLine className="h-3.5 w-3.5" /> Write
          </button>
        </div>
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
