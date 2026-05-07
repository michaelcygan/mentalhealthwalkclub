import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

const POOL = [
  // heavy
  "anxious","overwhelmed","running on fumes","wrung out","numb","static","raw","heavy","sad","grieving","lonely","burned out","exhausted","spiraling","foggy","brittle","stuck","disconnected","hollow","weepy","tight chest","short fuse",
  // tender
  "tender","soft","low-grade hum","unsettled","restless","fragile","a little off","quiet","okay-ish","wistful","reflective","slow","drowsy","pensive","craving stillness","craving movement","sentimental","homesick",
  // light
  "okay","steady","sturdy","clear","open","hopeful","quietly proud","buoyant","lighter","ready","grateful","curious","warm","spacious","content","focused","playful","calm","present","golden",
  // company
  "just need company","prefer not to say","need to vent","need to think","need silence",
];

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 1;
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
}

function Chip({ word, selected, onClick }: { word: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-200 ${selected ? "border-forest bg-forest text-primary-foreground shadow-soft scale-[1.04]" : "border-border bg-card/80 backdrop-blur-sm hover:border-forest/50"}`}
    >
      {word}
    </button>
  );
}

export function MoodCloud({ value, onChange }: Props) {
  const [seed] = useState(() => Math.floor(Date.now() / 1000));
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const shuffled = shuffle(POOL, seed);
    const third = Math.ceil(shuffled.length / 3);
    return [shuffled.slice(0, third), shuffled.slice(third, third * 2), shuffled.slice(third * 2)];
  }, [seed]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => q ? POOL.filter(w => w.includes(q)).slice(0, 24) : [], [q]);

  const select = (w: string) => { onChange(w); buzz(); };

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklab,var(--forest)_8%,transparent),_transparent_60%)]" />

      <div className="relative mb-3 flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-2 shadow-soft backdrop-blur-sm focus-within:border-forest/50">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && q) { select(matches[0] ?? q); setQuery(""); (e.target as HTMLInputElement).blur(); } }}
          placeholder="search a feeling, or type your own…"
          className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/70 focus:outline-none"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="clear" className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {q ? (
        <div className="flex flex-wrap gap-2">
          {matches.length === 0 ? (
            <button onClick={() => { select(q); setQuery(""); }} className="rounded-full border border-dashed border-forest/40 bg-card/60 px-3.5 py-1.5 text-sm italic text-forest hover:bg-accent/60">
              use “{q}”
            </button>
          ) : (
            matches.map((w) => <Chip key={w} word={w} selected={value === w} onClick={() => { select(w); setQuery(""); }} />)
          )}
        </div>
      ) : (
        <div className="-mx-4 space-y-2 px-4 sm:mx-0 sm:px-0">
          {rows.map((row, idx) => {
            const dir = idx % 2 === 0 ? "mood-marquee-l" : "mood-marquee-r";
            const speed = `${55 + idx * 12}s`;
            // Duplicate row contents for seamless loop
            const doubled = [...row, ...row];
            return (
              <div key={idx} className="mood-row overflow-hidden">
                <div className={`mood-track ${dir}`} style={{ ["--s" as string]: speed }}>
                  {doubled.map((w, i) => (
                    <Chip key={`${w}-${i}`} word={w} selected={value === w} onClick={() => select(w)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
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
