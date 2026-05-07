import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Pause, Play, Sparkles } from "lucide-react";
import { pickPrompts, type ReflectionPrompt } from "@/lib/reflection-prompts";

interface Props {
  mood: string | null;
  /** ms between prompts. default 18s; 24s in music branch */
  intervalMs?: number;
  /** When the prompt was matched specifically to mood (vs universal) */
  showPersonalizedChip?: boolean;
  /** Notified when the user long-presses to save a prompt */
  onSavePrompt?: (text: string) => void;
  className?: string;
}

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function ReflectionDrift({
  mood,
  intervalMs = 18_000,
  showPersonalizedChip = true,
  onSavePrompt,
  className = "",
}: Props) {
  // Stable seed so prompts don't reshuffle every re-render
  const seed = useMemo(() => Math.floor(Math.random() * 100000), []);
  const list: ReflectionPrompt[] = useMemo(
    () => pickPrompts(mood, 30, { seed }),
    [mood, seed],
  );
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [fadeKey, setFadeKey] = useState(0);
  const longPressRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const advance = useCallback(() => {
    setIdx((i) => (i + 1) % list.length);
    setFadeKey((k) => k + 1);
  }, [list.length]);

  useEffect(() => {
    if (paused || list.length <= 1) return;
    const t = window.setInterval(advance, intervalMs);
    return () => window.clearInterval(t);
  }, [paused, advance, intervalMs, list.length]);

  if (list.length === 0) return null;
  const current = list[idx];
  const isPersonalized = showPersonalizedChip && current.family !== "universal";

  const handleSave = () => {
    if (!current) return;
    onSavePrompt?.(current.text);
    setSavedFlash(true);
    try { (navigator as Navigator & { vibrate?: (p: number) => boolean }).vibrate?.(8); } catch { /* noop */ }
    window.setTimeout(() => setSavedFlash(false), 1400);
  };

  const startLongPress = () => {
    longPressFiredRef.current = false;
    longPressRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      handleSave();
    }, 550);
  };
  const endLongPress = () => {
    if (longPressRef.current) { window.clearTimeout(longPressRef.current); longPressRef.current = null; }
  };
  const handleClick = () => {
    if (longPressFiredRef.current) return; // long-press already handled
    setPaused((p) => !p);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-forest/15 bg-gradient-to-br from-cream/60 via-card to-accent/30 p-5 ${className}`}
    >
      <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-forest/60" />
          a thought to walk with
        </span>
        {isPersonalized && (
          <span className="inline-flex items-center gap-1 rounded-full border border-forest/20 bg-forest/5 px-2 py-0.5 text-[9px] tracking-wider text-forest/80">
            <Sparkles className="h-2.5 w-2.5" /> for you
          </span>
        )}
      </div>

      <button
        onClick={handleClick}
        onPointerDown={startLongPress}
        onPointerUp={endLongPress}
        onPointerLeave={endLongPress}
        onPointerCancel={endLongPress}
        aria-label="Tap to pause, hold to save this prompt"
        className="block w-full select-none text-left"
      >
        <p
          key={fadeKey}
          className="font-serif text-lg italic leading-snug text-foreground/90 md:text-xl"
          style={{
            animation: REDUCED_MOTION
              ? "none"
              : "reflection-fade 700ms ease-out",
          }}
        >
          {current.text}
        </p>
      </button>

      {/* Hairline progress + controls */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Resume" : "Pause"}
          className="grid h-7 w-7 place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-forest/40 hover:text-foreground"
        >
          {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
        </button>

        <div className="relative h-px flex-1 overflow-hidden rounded bg-border">
          {!paused && !REDUCED_MOTION && (
            <span
              key={`bar-${fadeKey}`}
              className="absolute inset-y-0 left-0 bg-forest/60"
              style={{ animation: `reflection-bar ${intervalMs}ms linear forwards` }}
            />
          )}
        </div>

        <button
          onClick={advance}
          aria-label="Next prompt"
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {savedFlash && (
        <p className="absolute inset-x-0 bottom-2 text-center font-serif text-[11px] italic text-forest/80">
          saved for your reflection
        </p>
      )}
    </div>
  );
}
