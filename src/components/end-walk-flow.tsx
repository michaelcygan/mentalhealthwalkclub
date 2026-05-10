import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MoodCloud, WeightBar } from "@/components/mood-cloud";
import { pickEndWalkStarters } from "@/lib/reflection-prompts";

interface Props {
  moodBefore: string | null;
  moodBeforeScore: number | null;
  elapsed: number;
  miles: number;
  savedPrompts?: string[];
  onSave: (out: { moodAfter: string; moodAfterScore: number | null; reflection: string }) => void | Promise<void>;
}

export function EndWalkFlow({ moodBefore, moodBeforeScore, elapsed, miles, savedPrompts = [], onSave }: Props) {
  const [step, setStep] = useState<0 | 1>(0);
  const [moodAfter, setMoodAfter] = useState("");
  const [moodAfterScore, setMoodAfterScore] = useState<number | null>(null);
  const [showStarters, setShowStarters] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pre-seed reflection with any prompts the user long-pressed during the walk
  const initialReflection = useMemo(
    () => savedPrompts.map((p) => `"${p}"`).join("\n\n"),
    [savedPrompts],
  );
  const [reflection, setReflection] = useState(initialReflection);
  const savedRef = useRef(false);
  const interactedRef = useRef(false);

  // Mark interaction so autosave-on-unmount doesn't fire on a no-op view
  useEffect(() => {
    if (moodAfter || moodAfterScore !== null || reflection !== initialReflection) {
      interactedRef.current = true;
    }
  }, [moodAfter, moodAfterScore, reflection, initialReflection]);

  const delta = useMemo(() => {
    if (moodBeforeScore && moodAfterScore) return moodAfterScore - moodBeforeScore;
    return null;
  }, [moodBeforeScore, moodAfterScore]);

  const save = () => {
    if (savedRef.current) return;
    savedRef.current = true;
    onSave({ moodAfter, moodAfterScore, reflection });
  };

  // Autosave on unmount only if the user actually engaged with the form
  useEffect(() => {
    return () => {
      if (savedRef.current) return;
      if (!interactedRef.current && savedPrompts.length === 0) return;
      savedRef.current = true;
      onSave({ moodAfter, moodAfterScore, reflection });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reflectionChips = delta && delta > 0
    ? ["the air helped", "moving through it", "let it go", "small win"]
    : delta && delta < 0
      ? ["still in it", "needed more time", "tomorrow", "showed up anyway"]
      : ["just walked", "needed this", "quiet"];

  const starters = pickEndWalkStarters(delta);

  if (step === 1) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-6 px-4 py-10 text-center">
        <div className="rounded-3xl gradient-forest p-10 text-primary-foreground shadow-elevated animate-in fade-in zoom-in duration-700">
          <p className="font-serif text-xs italic opacity-80">{moodBefore ?? "started"} → {moodAfter || "okay"}</p>
          {delta !== null && <div className="mt-2 font-serif text-6xl tabular-nums">{delta > 0 ? `+${delta}` : delta}</div>}
          <p className="mt-2 text-xs uppercase tracking-widest opacity-80">{Math.round(elapsed / 60)} min · {miles.toFixed(2)} mi</p>
        </div>
        <p className="font-serif italic text-muted-foreground">Still here. Still walking.</p>
        <Button
          onClick={save}
          style={{ touchAction: "manipulation" }}
          className="h-14 w-full max-w-sm rounded-2xl bg-forest text-base font-medium text-primary-foreground shadow-soft transition active:scale-[0.98] hover:opacity-90"
        >
          Save to journal
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pt-6 pb-[max(env(safe-area-inset-bottom),5rem)]">
      <div>
        <p className="font-serif text-xs italic text-muted-foreground">You started {moodBefore ?? "the walk"}.</p>
        <h2 className="mt-1 font-serif text-3xl">How are you arriving?</h2>
        <p className="mt-1 text-xs text-muted-foreground">Each part is optional. Keep what serves you.</p>
      </div>

      <MoodCloud value={moodAfter} onChange={setMoodAfter} compact />

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          How heavy does it feel? <span className="lowercase italic tracking-normal text-muted-foreground/70">(optional)</span>
        </p>
        <WeightBar value={moodAfterScore} onChange={setMoodAfterScore} />
        {delta !== null && (
          <div className={`mt-2 text-center text-sm ${delta > 0 ? "text-forest" : delta < 0 ? "text-clay" : "text-muted-foreground"}`}>
            {delta > 0 ? `+${delta} lighter` : delta < 0 ? `${delta} heavier` : "no change"}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            A line for future you <span className="lowercase italic tracking-normal text-muted-foreground/70">(optional)</span>
          </p>
          <button
            onClick={() => setShowStarters((s) => !s)}
            className="inline-flex items-center gap-1 text-[11px] italic text-forest/80 underline-offset-4 hover:underline"
          >
            <Sparkles className="h-3 w-3" /> {showStarters ? "hide" : "need a starting line?"}
          </button>
        </div>

        {showStarters && (
          <div className="mb-2 space-y-1 rounded-2xl border border-forest/15 bg-secondary/40 p-2">
            {starters.map((s) => (
              <button
                key={s}
                onClick={() => { setReflection((r) => r ? `${r}\n${s} — ` : `${s} — `); }}
                className="block w-full rounded-xl px-3 py-2 text-left font-serif text-sm italic text-foreground/80 hover:bg-card"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="mb-2 flex flex-wrap gap-2 text-xs">
          {reflectionChips.map((s) => (
            <button key={s} onClick={() => setReflection((r) => r ? `${r} · ${s}` : s)} className="rounded-full border border-border bg-card px-3 py-1.5 hover:border-forest/40">{s}</button>
          ))}
        </div>
        <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} rows={savedPrompts.length > 0 ? 5 : 2} placeholder="A small thought…" className="w-full rounded-2xl border border-border bg-card p-3 text-sm focus:border-forest focus:outline-none" />
        {savedPrompts.length > 0 && (
          <p className="mt-1 text-[11px] italic text-muted-foreground">
            {savedPrompts.length} prompt{savedPrompts.length > 1 ? "s" : ""} from your walk seeded above.
          </p>
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-border bg-background/85 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <Button variant="outline" onClick={save} className="h-12 flex-1 rounded-2xl">Save now</Button>
        <Button onClick={() => setStep(1)} className="h-12 flex-1 rounded-2xl bg-forest text-primary-foreground hover:opacity-90">Continue</Button>
      </div>
    </div>
  );
}
