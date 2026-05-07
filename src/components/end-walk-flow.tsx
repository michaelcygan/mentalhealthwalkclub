import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MoodCloud, WeightBar } from "@/components/mood-cloud";

interface Props {
  moodBefore: string | null;
  moodBeforeScore: number | null;
  elapsed: number;
  miles: number;
  onSave: (out: { moodAfter: string; moodAfterScore: number | null; reflection: string }) => void | Promise<void>;
}

export function EndWalkFlow({ moodBefore, moodBeforeScore, elapsed, miles, onSave }: Props) {
  const [step, setStep] = useState<0 | 1>(0);
  const [moodAfter, setMoodAfter] = useState("");
  const [moodAfterScore, setMoodAfterScore] = useState<number | null>(null);
  const [reflection, setReflection] = useState("");
  const savedRef = useRef(false);

  const delta = useMemo(() => {
    if (moodBeforeScore && moodAfterScore) return moodAfterScore - moodBeforeScore;
    return null;
  }, [moodBeforeScore, moodAfterScore]);

  const save = () => {
    if (savedRef.current) return;
    savedRef.current = true;
    onSave({ moodAfter, moodAfterScore, reflection });
  };

  // Autosave on unmount so closing mid-flow doesn't orphan the walk
  useEffect(() => {
    return () => {
      if (!savedRef.current) {
        savedRef.current = true;
        onSave({ moodAfter, moodAfterScore, reflection });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reflectionChips = delta && delta > 0
    ? ["the air helped", "moving through it", "let it go", "small win"]
    : delta && delta < 0
      ? ["still in it", "needed more time", "tomorrow", "showed up anyway"]
      : ["just walked", "needed this", "quiet"];

  if (step === 1) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-5 py-10 text-center">
        <div className="rounded-3xl gradient-forest p-10 text-primary-foreground shadow-elevated animate-in fade-in zoom-in duration-700">
          <p className="font-serif text-xs italic opacity-80">{moodBefore ?? "started"} → {moodAfter || "okay"}</p>
          {delta !== null && <div className="mt-2 font-serif text-6xl tabular-nums">{delta > 0 ? `+${delta}` : delta}</div>}
          <p className="mt-2 text-xs uppercase tracking-widest opacity-80">{Math.round(elapsed / 60)} min · {miles.toFixed(2)} mi</p>
        </div>
        <p className="font-serif italic text-muted-foreground">Still here. Still walking.</p>
        <Button onClick={save} className="rounded-full bg-forest text-primary-foreground hover:opacity-90">Save to journal</Button>
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
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          A line for future you <span className="lowercase italic tracking-normal text-muted-foreground/70">(optional)</span>
        </p>
        <div className="mb-2 flex flex-wrap gap-2 text-xs">
          {reflectionChips.map((s) => (
            <button key={s} onClick={() => setReflection((r) => r ? `${r} · ${s}` : s)} className="rounded-full border border-border bg-card px-3 py-1.5 hover:border-forest/40">{s}</button>
          ))}
        </div>
        <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} rows={2} placeholder="A small thought…" className="w-full rounded-2xl border border-border bg-card p-3 text-sm focus:border-forest focus:outline-none" />
      </div>

      <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-border bg-background/85 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <Button variant="outline" onClick={save} className="h-12 flex-1 rounded-2xl">Save now</Button>
        <Button onClick={() => setStep(1)} className="h-12 flex-1 rounded-2xl bg-forest text-primary-foreground hover:opacity-90">Continue</Button>
      </div>
    </div>
  );
}
