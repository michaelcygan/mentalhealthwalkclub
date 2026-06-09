import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Shuffle, PenLine } from "lucide-react";
import { PROMPTS, type ReflectionPrompt } from "@/lib/reflection-prompts";
import { ReflectionWriteSheet } from "./reflection-write-sheet";

/** Stable shuffle from a numeric seed (mulberry32). */
function shuffled<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    const j = Math.floor(r * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickFive(seed: number): ReflectionPrompt[] {
  const pool = PROMPTS.filter((p) => p.family === "universal");
  return shuffled(pool, seed).slice(0, 5);
}

export function ReflectionRotator() {
  const [seed, setSeed] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const k = "mhwc.home.reflect.seed";
    const cur = window.sessionStorage.getItem(k);
    if (cur) return Number(cur) || 1;
    const s = Math.floor(Math.random() * 1e9);
    window.sessionStorage.setItem(k, String(s));
    return s;
  });
  const prompts = useMemo(() => pickFive(seed), [seed]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [writeOpen, setWriteOpen] = useState(false);

  useEffect(() => {
    if (paused || writeOpen) return;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % prompts.length), 12000);
    return () => window.clearInterval(t);
  }, [paused, writeOpen, prompts.length]);

  const current = prompts[idx];
  if (!current) return null;

  return (
    <>
      <Card
        className="rounded-2xl border-border bg-card/90 p-5 shadow-soft backdrop-blur-sm"
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Daily Reflection
        </div>
        <button
          type="button"
          onClick={() => setWriteOpen(true)}
          className="mt-2 block w-full text-left"
          aria-label="Write a reflection"
        >
          <p key={current.id} className="wp-reflect-fade font-serif text-xl leading-snug text-foreground">
            {current.text}
          </p>
        </button>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1.5">
            {prompts.map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full transition ${i === idx ? "bg-foreground" : "bg-muted"}`} />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setWriteOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              <PenLine className="h-3.5 w-3.5" /> Write
            </button>
            <button
              type="button"
              onClick={() => setIdx((i) => (i + 1) % prompts.length)}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:opacity-90"
            >
              <Shuffle className="h-3.5 w-3.5" /> Shuffle
            </button>
          </div>
        </div>
      </Card>

      <ReflectionWriteSheet
        open={writeOpen}
        onOpenChange={setWriteOpen}
        prompt={{ id: current.id, text: current.text }}
        source="home_reflection"
      />
    </>
  );
}
