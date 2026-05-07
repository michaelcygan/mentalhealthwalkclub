import { useMemo, useState } from "react";
import { Shuffle } from "lucide-react";

const POOL = [
  // heavy
  "anxious","overwhelmed","running on fumes","wrung out","numb","static","raw","heavy","sad","grieving","lonely","burned out",
  // tender
  "tender","soft","low-grade hum","unsettled","restless","fragile","a little off","quiet","okay-ish",
  // light
  "okay","steady","sturdy","clear","open","hopeful","quietly proud","buoyant","lighter","ready",
  // company
  "just need company","prefer not to say",
];

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const buzz = () => { try { navigator.vibrate?.(8); } catch { /* noop */ } };

interface Props {
  value: string;
  onChange: (v: string) => void;
  count?: number;
}

export function MoodCloud({ value, onChange, count = 14 }: Props) {
  const [seed, setSeed] = useState(() => Math.floor(Date.now() / 1000));
  const [typed, setTyped] = useState("");
  const words = useMemo(() => {
    const picked = shuffle(POOL, seed).slice(0, count);
    if (value && !picked.includes(value)) picked[0] = value;
    return picked;
  }, [seed, count, value]);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklab,var(--forest)_8%,transparent),_transparent_60%)]" />
      <div className="flex flex-wrap gap-2">
        {words.map((w, i) => {
          const selected = value === w;
          const dur = 6 + ((i * 1.7) % 4);
          const delay = (i * 0.31) % 3;
          return (
            <button
              key={w}
              onClick={() => { onChange(w); buzz(); }}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-all duration-200 motion-safe:[animation:drift_var(--d)_ease-in-out_var(--dl)_infinite] ${selected ? "scale-[1.06] border-forest bg-forest text-primary-foreground shadow-soft" : "border-border bg-card/80 backdrop-blur-sm hover:-translate-y-px hover:border-forest/50"}`}
              style={{ ["--d" as string]: `${dur}s`, ["--dl" as string]: `${delay}s` }}
            >
              {w}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => { setSeed((s) => s + 1); buzz(); }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-muted-foreground transition hover:border-forest/40 hover:text-forest"
        >
          <Shuffle className="h-3 w-3" /> shuffle
        </button>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onBlur={() => { if (typed.trim()) onChange(typed.trim().toLowerCase()); }}
          onKeyDown={(e) => { if (e.key === "Enter" && typed.trim()) { onChange(typed.trim().toLowerCase()); (e.target as HTMLInputElement).blur(); } }}
          placeholder="or type one word…"
          className="flex-1 border-b border-transparent bg-transparent px-1 py-1 text-xs italic text-foreground placeholder:text-muted-foreground/70 focus:border-forest/40 focus:outline-none"
        />
      </div>

      <style>{`@keyframes drift { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2px) } }`}</style>
    </div>
  );
}

interface WeightProps {
  value: number | null;
  onChange: (n: number) => void;
}

export function WeightBar({ value, onChange }: WeightProps) {
  const v = value ?? 0;
  return (
    <div>
      <div className="flex items-end justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <span>heavy</span>
        <span className="font-serif text-2xl normal-case tracking-normal text-foreground tabular-nums">{value ?? "—"}</span>
        <span>light</span>
      </div>
      <div
        role="slider"
        aria-valuemin={1}
        aria-valuemax={10}
        aria-valuenow={value ?? 0}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") onChange(Math.min(10, (value ?? 5) + 1));
          if (e.key === "ArrowLeft") onChange(Math.max(1, (value ?? 5) - 1));
        }}
        className="mt-2 flex h-11 w-full items-stretch gap-1 rounded-2xl border border-border bg-card/60 p-1.5"
      >
        {Array.from({ length: 10 }, (_, i) => {
          const n = i + 1;
          const filled = n <= v;
          return (
            <button
              key={n}
              type="button"
              onClick={() => { onChange(n); buzz(); }}
              aria-label={`${n} of 10`}
              className={`flex-1 rounded-md transition-all duration-300 ${filled ? "bg-forest" : "bg-foreground/5 hover:bg-foreground/10"}`}
              style={{ opacity: filled ? 0.4 + n * 0.06 : 1 }}
            />
          );
        })}
      </div>
    </div>
  );
}
