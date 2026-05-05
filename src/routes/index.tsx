import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Footprints, Users, Headphones, MapPin, Sparkles } from "lucide-react";
import heroImg from "@/assets/walk-hero.jpg";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: WalkTab,
  head: () => ({ meta: [{ title: "Walk — Mental Health Walk Club" }] }),
});

const FEELINGS = ["anxious","lonely","overwhelmed","sad","burned out","grieving","restless","okay","hopeful","just need company","prefer not to say"];

function WalkTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [walkType, setWalkType] = useState<"solo" | "guided_solo" | "irl_event" | "audio">("solo");
  const [feeling, setFeeling] = useState<string>("");
  const [moodScore, setMoodScore] = useState<number | null>(null);
  const [intention, setIntention] = useState("");
  const [busy, setBusy] = useState(false);
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);

  useEffect(() => {
    if (!user) return;
    const since = new Date(); since.setDate(since.getDate() - 7);
    supabase.from("walk_sessions").select("duration_seconds").eq("user_id", user.id).eq("status", "completed").gte("started_at", since.toISOString())
      .then(({ data }) => {
        const mins = (data ?? []).reduce((s, r) => s + Math.round((r.duration_seconds ?? 0) / 60), 0);
        setWeeklyMinutes(mins);
      });
  }, [user]);

  const beginWalk = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.from("walk_sessions").insert({
        user_id: user.id,
        walk_type: walkType,
        status: "active",
        mood_before: feeling || null,
        mood_before_score: moodScore,
        intention: intention || null,
      }).select("id").single();
      if (error) throw error;
      navigate({ to: "/walk/active/$id" as never, params: { id: data.id } as never });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start walk");
    } finally {
      setBusy(false);
    }
  };

  if (step === 0) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-3xl shadow-elevated">
          <img src={heroImg} alt="A quiet forest path at golden hour" width={1536} height={1024} className="h-56 w-full object-cover md:h-72" />
          <div className="absolute inset-0 bg-gradient-to-t from-forest/80 via-forest/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-primary-foreground">
            <p className="font-serif text-xs italic opacity-90">Come as you are. Walk at your pace.</p>
            <h1 className="mt-1 font-serif text-3xl leading-tight md:text-4xl">Take the walk. Let it count.</h1>
          </div>
        </div>

        <Button onClick={() => setStep(1)} className="h-16 w-full rounded-2xl bg-forest text-base font-medium text-primary-foreground shadow-soft hover:opacity-90">
          <Footprints className="mr-2 h-5 w-5" />
          Start Mental Health Walk
        </Button>

        <div className="grid grid-cols-2 gap-3">
          <QuickAction icon={Footprints} label="Walk Solo" onClick={() => { setWalkType("solo"); setStep(1); }} />
          <QuickAction icon={Sparkles} label="Guided Solo" onClick={() => { setWalkType("guided_solo"); setStep(1); }} />
          <QuickAction icon={Headphones} label="Audio Walk" sub="On your feet" onClick={() => { setWalkType("audio"); setStep(1); }} />
          <QuickAction icon={MapPin} label="Find an IRL Walk" onClick={() => navigate({ to: "/events" as never })} />
        </div>

        <Card className="rounded-2xl border-border bg-card p-5 shadow-soft">
          <div className="flex items-baseline justify-between">
            <h3 className="font-serif text-lg">This week</h3>
            <span className="text-sm text-muted-foreground">{weeklyMinutes} min walked</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${Math.min(100, (weeklyMinutes / 90) * 100)}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Goal: 90 minutes a week. Small walks count.</p>
        </Card>
      </div>
    );
  }

  if (step === 1) {
    return (
      <FlowCard title="How are you walking today?" sub="No wrong answer.">
        <div className="grid gap-2">
          {([
            ["solo", "Walk Solo", "Walking alone still counts."],
            ["guided_solo", "Guided Solo Walk", "A gentle voice in your ear."],
            ["audio", "Audio Walk with Others", "Live audio, only while walking."],
            ["irl_event", "IRL / Event Walk", "Meeting people in real life."],
          ] as const).map(([v, label, sub]) => (
            <button key={v} onClick={() => { setWalkType(v); setStep(2); }} className={`rounded-2xl border p-4 text-left transition ${walkType === v ? "border-forest bg-accent" : "border-border bg-card hover:border-forest/40"}`}>
              <div className="font-medium">{label}</div>
              <div className="text-sm text-muted-foreground">{sub}</div>
            </button>
          ))}
        </div>
      </FlowCard>
    );
  }

  if (step === 2) {
    return (
      <FlowCard title="How are you feeling?" sub="One word is enough.">
        <div className="flex flex-wrap gap-2">
          {FEELINGS.map((f) => (
            <button key={f} onClick={() => setFeeling(f)} className={`rounded-full border px-4 py-2 text-sm transition ${feeling === f ? "border-forest bg-forest text-primary-foreground" : "border-border bg-card hover:border-forest/40"}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="mt-6">
          <label className="text-sm text-muted-foreground">Optional: 1 (heavy) → 10 (light)</label>
          <input type="range" min={1} max={10} value={moodScore ?? 5} onChange={(e) => setMoodScore(Number(e.target.value))} className="mt-2 w-full accent-[var(--forest)]" />
          {moodScore && <div className="text-xs text-muted-foreground">{moodScore}/10</div>}
        </div>
        <Button onClick={() => setStep(3)} className="mt-6 w-full rounded-full bg-forest text-primary-foreground hover:opacity-90">Continue</Button>
      </FlowCard>
    );
  }

  return (
    <FlowCard title="An intention?" sub="Optional. Skip if you'd rather just go.">
      <textarea value={intention} onChange={(e) => setIntention(e.target.value)} placeholder="e.g. let my shoulders drop" rows={3} className="w-full rounded-2xl border border-border bg-card p-4 text-sm focus:border-forest focus:outline-none" />
      <Button onClick={beginWalk} disabled={busy} className="mt-6 h-14 w-full rounded-2xl bg-forest text-base text-primary-foreground hover:opacity-90">
        {busy ? "Starting…" : "Start walking"}
      </Button>
      <p className="mt-3 text-center font-serif text-xs italic text-muted-foreground">A small walk is still a walk.</p>
    </FlowCard>
  );
}

function QuickAction({ icon: Icon, label, sub, onClick }: { icon: typeof Footprints; label: string; sub?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl border border-border bg-card p-4 text-left shadow-soft transition hover:border-forest/40">
      <Icon className="mb-2 h-5 w-5 text-forest" />
      <div className="text-sm font-medium">{label}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </button>
  );
}

function FlowCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 pt-6">
      <h2 className="font-serif text-3xl leading-tight">{title}</h2>
      {sub && <p className="text-muted-foreground">{sub}</p>}
      <div className="pt-2">{children}</div>
    </div>
  );
}
