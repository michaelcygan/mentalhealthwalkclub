import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Footprints, Headphones, MapPin, Sparkles, HeartHandshake, Lock, Play } from "lucide-react";
import heroImg from "@/assets/walk-hero.jpg";
import { toast } from "sonner";
import { NowAndNext } from "@/components/now-and-next";
import { WeeklyRing } from "@/components/weekly-ring";
import { MoodCloud, WeightBar } from "@/components/mood-cloud";
import { GuidePicker, type GuidedTrack } from "@/components/guide-picker";
import { haptics } from "@/lib/device";
import { HeroGradient } from "@/components/hero-gradient";
import { useLiveCount } from "@/hooks/use-live-count";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { useAmbient } from "@/lib/ambient-context";

export const Route = createFileRoute("/")({
  component: WalkTab,
  head: () => ({ meta: [{ title: "Mental Health Walk Club" }] }),
});

const MODE_PREFACE: Record<string, string> = {
  solo: "Walking alone still counts.",
  guided_solo: "A gentle voice in your ear.",
  audio: "You'll be matched once you start moving.",
  irl_event: "Real people, real sidewalks.",
};

type WalkType = "solo" | "guided_solo" | "irl_event" | "audio";

function WalkTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { requireAuth, openWelcome } = useAuthPrompt();
  const ambient = useAmbient();
  const beganWalkRef = useRef(false);

  // Pre-walk state lives in the bottom sheet now, not as a step machine.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickGuide, setPickGuide] = useState(false);
  const [walkType, setWalkType] = useState<WalkType>("solo");
  const [feeling, setFeeling] = useState<string>("");
  const [moodScore, setMoodScore] = useState<number | null>(null);
  const [intention, setIntention] = useState("");
  const [busy, setBusy] = useState(false);

  // Home state
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [weeklyDots, setWeeklyDots] = useState<boolean[]>([false, false, false, false, false, false, false]);
  const [activeWalkId, setActiveWalkId] = useState<string | null>(null);
  const [totalWalks, setTotalWalks] = useState<number | null>(null);
  const [lastReflection, setLastReflection] = useState<string | null>(null);

  // Web Share Target → ?intention=… seeds the next walk
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const seed = u.searchParams.get("intention") || u.searchParams.get("text") || u.searchParams.get("title");
    if (seed) {
      setIntention(seed.slice(0, 280));
      setSheetOpen(true);
    }
    if (u.searchParams.get("start") === "1") setSheetOpen(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("walk_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "completed").then(({ count }) => setTotalWalks(count ?? 0));
    supabase.from("walk_sessions").select("reflection_note").eq("user_id", user.id).eq("status","completed").not("reflection_note","is",null).order("started_at",{ ascending:false }).limit(1).maybeSingle().then(({ data }) => setLastReflection(data?.reflection_note ?? null));
    const since = new Date(); since.setDate(since.getDate() - 7); since.setHours(0,0,0,0);
    supabase.from("walk_sessions").select("started_at,duration_seconds,status")
      .eq("user_id", user.id).gte("started_at", since.toISOString())
      .then(({ data }) => {
        const rows = data ?? [];
        const mins = rows.filter(r => r.status === "completed").reduce((s, r) => s + Math.round((r.duration_seconds ?? 0) / 60), 0);
        setWeeklyMinutes(mins);
        const today = new Date(); today.setHours(0,0,0,0);
        const dots = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(today); d.setDate(d.getDate() - (6 - i));
          const next = new Date(d); next.setDate(next.getDate() + 1);
          return rows.some(r => { const t = new Date(r.started_at).getTime(); return t >= d.getTime() && t < next.getTime() && r.status === "completed"; });
        });
        setWeeklyDots(dots);
        const active = rows.find(r => r.status === "active");
        if (active) {
          supabase.from("walk_sessions").select("id").eq("user_id", user.id).eq("status","active").order("started_at",{ascending:false}).limit(1).maybeSingle()
            .then(({ data: a }) => setActiveWalkId(a?.id ?? null));
        } else setActiveWalkId(null);
      });
  }, [user]);

  const beginWalk = async (track?: GuidedTrack | null) => {
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
        guided_track_id: track?.id ?? null,
      }).select("id").single();
      if (error) throw error;
      navigate({ to: "/walk/active/$id" as never, params: { id: data.id } as never });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start walk");
    } finally {
      setBusy(false);
    }
  };

  const openSheet = (type: WalkType) => requireAuth(() => {
    haptics.soft();
    setWalkType(type);
    setPickGuide(false);
    setSheetOpen(true);
  });

  const proceed = () => {
    if (walkType === "guided_solo") setPickGuide(true);
    else beginWalk();
  };

  // Logged-out marketing landing
  if (!user) {
    return (
      <div className="space-y-8">
        <div className="relative overflow-hidden rounded-3xl shadow-elevated">
          <img src={heroImg} alt="A quiet forest path at golden hour" width={1536} height={1024} className="h-72 w-full object-cover md:h-96" />
          <div className="absolute inset-0 bg-gradient-to-t from-forest/85 via-forest/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-primary-foreground md:p-10">
            <p className="font-serif text-xs italic opacity-90">Come as you are. Walk at your pace.</p>
            <h1 className="mt-2 max-w-xl font-serif text-4xl leading-tight text-balance md:text-5xl">Take the walk. Let it count.</h1>
            <p className="mt-3 max-w-md text-sm opacity-90 text-pretty md:text-base">Peer-supported walks for the days that feel heavy. Solo, Walk & Talk, or Local — never alone.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => requireAuth(() => openSheet("solo"))} className="rounded-full bg-cream text-foreground hover:bg-cream/90">
                <Footprints className="mr-2 h-4 w-4" /> Start a walk
              </Button>
              <Button onClick={openWelcome} variant="outline" className="rounded-full border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                How it works
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <ValueCard icon={Footprints} title="Walk solo" body="A small walk is still a walk. Track time, distance, and how you arrive home." />
          <ValueCard icon={Headphones} title="Walk & Talks" body="Live, gentle Walk & Talks — only available once you're actually moving." />
          <ValueCard icon={MapPin} title="Local Walks" body="Real people, real sidewalks. Meet your neighborhood at a Sunday Reset." />
        </div>

        <Card className="rounded-3xl border-border bg-card p-7 shadow-soft md:p-9">
          <div className="grid gap-6 md:grid-cols-[1.2fr,1fr] md:items-center">
            <div>
              <h2 className="font-serif text-2xl text-balance md:text-3xl">A different kind of social app</h2>
              <p className="mt-3 text-muted-foreground text-pretty">No feeds. No chat. No doomscroll. Groups are quiet affinity tags — Anxiety, Burnout, Sunday Reset, your city — that surface walks that fit you. The socializing happens in person, or on your feet with audio.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={() => requireAuth(() => openSheet("solo"))} className="rounded-full bg-forest text-primary-foreground hover:opacity-90">
                  Take your first walk
                </Button>
                <Button onClick={openWelcome} variant="ghost" className="rounded-full">Learn more</Button>
              </div>
            </div>
            <ul className="space-y-3 text-sm">
              <Bullet icon={HeartHandshake}>Peer support, not therapy.</Bullet>
              <Bullet icon={Lock}>Walks, moods, and reflections stay private to you.</Bullet>
              <Bullet icon={Sparkles}>Gentle badges for showing up — never streak shame.</Bullet>
            </ul>
          </div>
        </Card>

        <p className="pt-2 text-center font-serif text-sm italic text-muted-foreground">
          You don't have to walk through it alone.
        </p>
      </div>
    );
  }

  // ───────────────────────── Logged-in: one calm scroll ─────────────────────────
  const hour = new Date().getHours();
  const greet = hour < 5 ? "A late night walk?" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const name = (user.user_metadata?.display_name as string | undefined)?.split(" ")[0] || "";
  const streak = (() => { let s = 0; for (let i = weeklyDots.length - 1; i >= 0; i--) { if (weeklyDots[i]) s++; else break; } return s; })();
  const microState = (() => {
    if (totalWalks === 0) return "Your first walk is the hardest. Five minutes around the block counts.";
    if (streak >= 4) return "Eight minutes is enough — your body knows.";
    if (weeklyDots[weeklyDots.length - 2]) return "Two days in a row feels good.";
    if (weeklyMinutes === 0) return "A small one tonight?";
    return "Show up however you can.";
  })();

  return (
    <>
      <div className="space-y-5">
        <HeroGradient className="p-6 md:p-8">
          <p className="font-serif text-xs italic text-foreground/70">Come as you are. Walk at your pace.</p>
          <h1 className="mt-1 font-serif text-2xl leading-tight text-balance md:text-3xl">{greet}{name ? `, ${name}` : ""}.</h1>
          <p className="mt-2 max-w-md font-serif text-sm italic text-foreground/75 text-pretty">{microState}</p>
        </HeroGradient>

        {activeWalkId && (
          <Link to={"/walk/active/$id" as never} params={{ id: activeWalkId } as never} className="flex items-center justify-between gap-3 rounded-2xl border border-forest/40 bg-accent/40 p-4 transition hover:-translate-y-px">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-forest">Walk in progress</div>
              <div className="font-serif text-base">Continue where you left off</div>
            </div>
            <Play className="h-5 w-5 text-forest" />
          </Link>
        )}

        <StartCta onStart={() => openSheet("solo")} />

        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Other ways to walk</div>
          <div className="flex flex-wrap gap-2">
            <ModePill icon={Sparkles} label="Guided" onClick={() => openSheet("guided_solo")} />
            <ModePill icon={Headphones} label="Walk & Talk" onClick={() => openSheet("audio")} />
            <ModePill icon={MapPin} label="Local Walks" onClick={() => navigate({ to: "/events" as never })} />
          </div>
        </div>

        <NowAndNext />

        <Card className="rounded-2xl border-border bg-card p-5 shadow-soft">
          <WeeklyRing minutes={weeklyMinutes} dots={weeklyDots} />
          {streak > 0 && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              <span className="font-medium text-forest tabular-nums">{streak}-day</span> streak · rest is part of walking.
            </p>
          )}
        </Card>

        {lastReflection && (
          <figure className="px-1 pt-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">From your last walk</div>
            <blockquote className="mt-1 font-serif text-base italic leading-snug text-foreground/85 text-pretty before:mr-1 before:text-forest before:content-['“'] after:text-forest after:content-['”']">{lastReflection}</blockquote>
          </figure>
        )}
      </div>

      <PreWalkSheet
        open={sheetOpen}
        onOpenChange={(v) => { setSheetOpen(v); if (!v) setPickGuide(false); }}
        walkType={walkType}
        setWalkType={setWalkType}
        feeling={feeling}
        setFeeling={setFeeling}
        moodScore={moodScore}
        setMoodScore={setMoodScore}
        intention={intention}
        setIntention={setIntention}
        busy={busy}
        pickGuide={pickGuide}
        onProceed={proceed}
        onChooseTrack={(t) => { beginWalk(t); }}
        onSkipGuide={() => beginWalk(null)}
      />
    </>
  );
}

function PreWalkSheet({
  open, onOpenChange, walkType, setWalkType, feeling, setFeeling, moodScore, setMoodScore,
  intention, setIntention, busy, pickGuide, onProceed, onChooseTrack, onSkipGuide,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  walkType: WalkType; setWalkType: (t: WalkType) => void;
  feeling: string; setFeeling: (v: string) => void;
  moodScore: number | null; setMoodScore: (n: number | null) => void;
  intention: string; setIntention: (v: string) => void;
  busy: boolean; pickGuide: boolean;
  onProceed: () => void;
  onChooseTrack: (t: GuidedTrack) => void;
  onSkipGuide: () => void;
}) {
  const kbInset = useKeyboardInset();
  const label = useMemo(() =>
    walkType === "audio" ? "Walk & Talk"
    : walkType === "guided_solo" ? "Guided walk"
    : walkType === "irl_event" ? "Local walk"
    : "Solo walk", [walkType]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-1 text-left">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-forest/80">{label}</div>
          <DrawerTitle className="mt-1 font-serif text-2xl text-balance">How are you arriving?</DrawerTitle>
          <p className="mt-1 text-sm italic text-muted-foreground">{MODE_PREFACE[walkType]}</p>
        </DrawerHeader>

        {pickGuide ? (
          <div className="px-4 pb-6">
            <GuidePicker mood={feeling || null} onChoose={onChooseTrack} onSkip={onSkipGuide} />
          </div>
        ) : (
          <>
            <div className="space-y-5 overflow-y-auto px-4 pb-3">
              {/* Quick mode swap inside the sheet */}
              <div className="flex flex-wrap gap-1.5">
                {(["solo","guided_solo","audio"] as WalkType[]).map((t) => (
                  <button key={t} onClick={() => setWalkType(t)} className={`rounded-full border px-3 py-1 text-xs transition ${walkType === t ? "border-forest bg-forest text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>
                    {t === "solo" ? "Solo" : t === "guided_solo" ? "Guided" : "Walk & Talk"}
                  </button>
                ))}
              </div>

              <MoodCloud value={feeling} onChange={setFeeling} />

              <div className={`transition-all duration-500 ${feeling ? "max-h-40 opacity-100" : "max-h-0 overflow-hidden opacity-0"}`}>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">How heavy does it feel? <span className="lowercase italic tracking-normal text-muted-foreground/70">(optional)</span></p>
                <WeightBar value={moodScore} onChange={setMoodScore} />
              </div>

              <div className={`transition-all duration-500 ${moodScore ? "max-h-60 opacity-100" : "max-h-0 overflow-hidden opacity-0"}`}>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">An intention? <span className="lowercase italic tracking-normal text-muted-foreground/70">optional</span></p>
                <textarea value={intention} onChange={(e) => setIntention(e.target.value)} placeholder="e.g. let my shoulders drop" rows={2} className="w-full rounded-2xl border border-border bg-card p-3 text-sm focus:border-forest focus:outline-none" />
              </div>
            </div>

            <div
              className="border-t border-border glass px-4 pt-3"
              style={{ paddingBottom: `calc(max(env(safe-area-inset-bottom), 0.75rem) + ${kbInset}px)` }}
            >
              <Button onClick={onProceed} disabled={busy} className="h-14 w-full rounded-2xl bg-forest text-base text-primary-foreground hover:opacity-90">
                {busy ? "Starting…" : walkType === "guided_solo" ? "Choose a guide" : "Begin walking"}
              </Button>
              <button onClick={onProceed} className="mt-2 block w-full text-center text-xs italic text-muted-foreground hover:text-forest">skip the rest, just walk</button>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function ModePill({ icon: Icon, label, onClick }: { icon: typeof Footprints; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm shadow-soft transition hover:-translate-y-px hover:border-forest/50">
      <Icon className="h-4 w-4 text-forest" />
      {label}
    </button>
  );
}

function StartCta({ onStart }: { onStart: () => void }) {
  const live = useLiveCount();
  return (
    <div className="relative">
      <Button
        onClick={onStart}
        className="breathe relative h-16 w-full rounded-2xl bg-forest text-base font-medium text-primary-foreground shadow-soft transition active:scale-[0.99] hover:opacity-90"
      >
        <Footprints className="mr-2 h-5 w-5" /> Start a walk
      </Button>
      {live > 0 && (
        <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest/60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-forest" />
          </span>
          <span><span className="font-medium text-forest tabular-nums">{live}</span> walking & talking now</span>
        </div>
      )}
    </div>
  );
}

function ValueCard({ icon: Icon, title, body }: { icon: typeof Footprints; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent">
        <Icon className="h-5 w-5 text-forest" />
      </div>
      <h3 className="mt-3 font-serif text-lg">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground text-pretty">{body}</p>
    </div>
  );
}

function Bullet({ icon: Icon, children }: { icon: typeof Footprints; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
      <span className="text-foreground/85">{children}</span>
    </li>
  );
}
