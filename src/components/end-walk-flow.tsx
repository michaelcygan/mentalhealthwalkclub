import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEELINGS = ["anxious","lonely","overwhelmed","sad","burned out","grieving","restless","okay","hopeful","just need company","prefer not to say"];

interface Props {
  moodBefore: string | null;
  moodBeforeScore: number | null;
  elapsed: number;
  miles: number;
  onSave: (out: { moodAfter: string; moodAfterScore: number | null; reflection: string }) => void | Promise<void>;
}

export function EndWalkFlow({ moodBefore, moodBeforeScore, elapsed, miles, onSave }: Props) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [moodAfter, setMoodAfter] = useState("");
  const [moodAfterScore, setMoodAfterScore] = useState<number | null>(null);
  const [reflection, setReflection] = useState("");

  const delta = useMemo(() => {
    if (moodBeforeScore && moodAfterScore) return moodAfterScore - moodBeforeScore;
    return null;
  }, [moodBeforeScore, moodAfterScore]);

  return (
    <div className="mx-auto max-w-lg space-y-6 pt-6">
      {step === 0 && (
        <>
          <div>
            <p className="font-serif text-xs italic text-muted-foreground">You started {moodBefore ?? "the walk"}.</p>
            <h2 className="mt-1 font-serif text-3xl">How are you arriving?</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {FEELINGS.map((f) => (
              <button key={f} onClick={() => { setMoodAfter(f); setStep(1); }} className={`rounded-full border px-4 py-2 text-sm transition ${moodAfter === f ? "border-forest bg-forest text-primary-foreground" : "border-border bg-card hover:border-forest/40"}`}>{f}</button>
            ))}
          </div>
          <button onClick={() => setStep(1)} className="text-xs text-muted-foreground underline">skip</button>
        </>
      )}
      {step === 1 && (
        <>
          <h2 className="font-serif text-3xl">On a scale of weight…</h2>
          <p className="text-sm text-muted-foreground">1 (heavy) → 10 (light)</p>
          <input type="range" min={1} max={10} value={moodAfterScore ?? 5} onChange={(e) => setMoodAfterScore(Number(e.target.value))} className="w-full accent-[var(--forest)]" />
          <div className="text-center font-serif text-4xl tabular-nums">{moodAfterScore ?? 5}</div>
          {delta !== null && (
            <div className={`text-center text-sm ${delta > 0 ? "text-forest" : delta < 0 ? "text-clay" : "text-muted-foreground"}`}>
              {delta > 0 ? `+${delta} lighter` : delta < 0 ? `${delta} heavier` : "no change"}
            </div>
          )}
          <Button onClick={() => setStep(2)} className="h-12 w-full rounded-2xl bg-forest text-primary-foreground hover:opacity-90">Continue <ArrowRight className="ml-1 h-4 w-4" /></Button>
        </>
      )}
      {step === 2 && (
        <>
          <h2 className="font-serif text-3xl">{delta && delta > 0 ? "What shifted?" : delta && delta < 0 ? "What felt hard?" : "Anything to remember?"}</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            {(delta && delta > 0
              ? ["the air helped", "moving through it", "let it go", "small win"]
              : delta && delta < 0
                ? ["still in it", "needed more time", "tomorrow", "showed up anyway"]
                : ["just walked", "needed this", "quiet"]
            ).map((s) => (
              <button key={s} onClick={() => setReflection((r) => r ? `${r} · ${s}` : s)} className="rounded-full border border-border bg-card px-3 py-1.5 hover:border-forest/40">{s}</button>
            ))}
          </div>
          <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} rows={3} placeholder="A line for future you…" className="w-full rounded-2xl border border-border bg-card p-4 text-sm focus:border-forest focus:outline-none" />
          <Button onClick={() => setStep(3)} className="h-12 w-full rounded-2xl bg-forest text-primary-foreground hover:opacity-90">Save walk</Button>
        </>
      )}
      {step === 3 && (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="rounded-3xl gradient-forest p-10 text-primary-foreground shadow-elevated animate-in fade-in zoom-in duration-700">
            <p className="font-serif text-xs italic opacity-80">{moodBefore ?? "started"} → {moodAfter || "okay"}</p>
            {delta !== null && <div className="mt-2 font-serif text-6xl tabular-nums">{delta > 0 ? `+${delta}` : delta}</div>}
            <p className="mt-2 text-xs uppercase tracking-widest opacity-80">{Math.round(elapsed / 60)} min · {miles.toFixed(2)} mi</p>
          </div>
          <p className="font-serif italic text-muted-foreground">Still here. Still walking.</p>
          <Button onClick={() => onSave({ moodAfter, moodAfterScore, reflection })} className="rounded-full bg-forest text-primary-foreground hover:opacity-90">Save to journal</Button>
        </div>
      )}
    </div>
  );
}
