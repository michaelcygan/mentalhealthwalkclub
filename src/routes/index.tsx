import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Footprints, Headphones, MapPin, Sparkles, Play } from "lucide-react";
import { toast } from "sonner";
import { LiveNowStrip } from "@/components/live-now-strip";
import { UpcomingFriendWalks } from "@/components/friend-walk/upcoming-friend-walks";
import { WeeklyRing } from "@/components/weekly-ring";
import { WeekInReview } from "@/components/week-in-review";
import { ComebackNudge } from "@/components/comeback-nudge";
import { MoodCloud, WeightBar } from "@/components/mood-cloud";
import { GuidePicker, type GuidedTrack } from "@/components/guide-picker";
import { haptics } from "@/lib/device";

import { HeroBand } from "@/components/home/hero-band";
import { WeatherModule } from "@/components/home/weather-module";
import { StickyWeekBar } from "@/components/home/sticky-week-bar";
import { TonightInYourGroups } from "@/components/home/tonight-in-your-groups";
import { WeatherPill } from "@/components/weather-pill";
import { useCurrentWeather, useGeolocation } from "@/hooks/use-weather";
import { useLiveCount } from "@/hooks/use-live-count";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useProfileStats } from "@/hooks/use-profile-stats";
import { useAmbient } from "@/lib/ambient-context";
import { EntryFlow } from "@/components/entry-flow/entry-flow";
import { DemoPreview } from "@/components/entry-flow/demo-preview";
import { DemoBanner } from "@/components/demo-banner";
import { useDemoMode } from "@/hooks/use-demo-mode";

export const Route = createFileRoute("/")({
  component: HomeRoute,
  head: () => ({ meta: [{ title: "Mental Health Walk Club" }] }),
});

function HomeRoute() {
  const { user, loading } = useAuth();
  const { demo } = useDemoMode();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setOnboarded(null); return; }
    supabase.from("profiles").select("onboarded_at").eq("id", user.id).maybeSingle()
      .then(({ data }) => setOnboarded(!!data?.onboarded_at));
  }, [user]);

  const markOnboarded = () => setOnboarded(true);

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="h-72 w-full animate-pulse rounded-3xl bg-muted/50 md:h-96" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-32 animate-pulse rounded-2xl bg-muted/40" />
          <div className="h-32 animate-pulse rounded-2xl bg-muted/40" />
          <div className="h-32 animate-pulse rounded-2xl bg-muted/40" />
        </div>
      </div>
    );
  }

  if (!user && demo) return (<><DemoBanner /><DemoPreview /></>);
  if (!user) return <EntryFlow />;
  if (onboarded === false) return <EntryFlow startAtOnboarding />;
  return <WalkTab />;
}


const MODE_PREFACE: Record<string, string> = {
  solo: "Walking alone still counts.",
  guided_solo: "A gentle voice in your ear.",
  audio: "You'll be matched once you start moving.",
  irl_event: "Real people, real sidewalks.",
};

type WalkType = "solo" | "guided_solo" | "irl_event" | "audio";

function WalkTab() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { requireAuth } = useAuthPrompt();
  const ambient = useAmbient();
  const beganWalkRef = useRef(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickGuide, setPickGuide] = useState(false);
  const [walkType, setWalkType] = useState<WalkType>("solo");
  const [feeling, setFeeling] = useState<string>("");
  const [moodScore, setMoodScore] = useState<number | null>(null);
  const [intention, setIntention] = useState("");
  const [busy, setBusy] = useState(false);

  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [weeklyDots, setWeeklyDots] = useState<boolean[]>([false, false, false, false, false, false, false]);
  const [activeWalkId, setActiveWalkId] = useState<string | null>(null);
  const [totalWalks, setTotalWalks] = useState<number | null>(null);
  const [lastReflection, setLastReflection] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const stats = useProfileStats(user?.id);

  // Web Share Target → ?intention=… seeds the next walk
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const seed = u.searchParams.get("intention") || u.searchParams.get("text") || u.searchParams.get("title");
    if (seed) { setIntention(seed.slice(0, 280)); setSheetOpen(true); }
    if (u.searchParams.get("start") === "1") setSheetOpen(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    // Single query: pulls last 7d of sessions + active session + total count via separate head query.
    // (Reflection note is derived from the last completed row in the same window when present;
    //  otherwise we fall back to a tiny query for the most recent reflection ever.)
    const since = new Date(); since.setDate(since.getDate() - 7); since.setHours(0,0,0,0);
    supabase.from("walk_sessions")
      .select("id,started_at,duration_seconds,status,reflection_note")
      .eq("user_id", user.id)
      .gte("started_at", since.toISOString())
      .order("started_at", { ascending: false })
      .then(({ data }) => {
        const rows = data ?? [];
        const completed = rows.filter(r => r.status === "completed");
        const mins = completed.reduce((s, r) => s + Math.round((r.duration_seconds ?? 0) / 60), 0);
        setWeeklyMinutes(mins);
        const today = new Date(); today.setHours(0,0,0,0);
        const dots = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(today); d.setDate(d.getDate() - (6 - i));
          const next = new Date(d); next.setDate(next.getDate() + 1);
          return rows.some(r => { const t = new Date(r.started_at).getTime(); return t >= d.getTime() && t < next.getTime() && r.status === "completed"; });
        });
        setWeeklyDots(dots);
        const active = rows.find(r => r.status === "active");
        setActiveWalkId(active?.id ?? null);
        const recent = completed.find(r => r.reflection_note);
        if (recent) {
          setLastReflection(recent.reflection_note);
        } else {
          // No reflection in the past 7d — fall back to the most recent ever (one extra query, but rare).
          supabase.from("walk_sessions")
            .select("reflection_note").eq("user_id", user.id).eq("status","completed")
            .not("reflection_note","is",null).order("started_at",{ ascending:false }).limit(1).maybeSingle()
            .then(({ data: r }) => setLastReflection(r?.reflection_note ?? null));
        }
      });
    supabase.from("walk_sessions").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("status", "completed")
      .then(({ count }) => setTotalWalks(count ?? 0));
  }, [user, refreshTick]);

  const { pull, refreshing } = usePullToRefresh({
    enabled: !!user,
    onRefresh: async () => {
      haptics.soft();
      setRefreshTick(t => t + 1);
      await new Promise(r => setTimeout(r, 600));
    },
  });

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
      const ownsAudio = walkType === "audio" || (walkType === "guided_solo" && track?.id);
      if (ownsAudio) ambient.stop(400);
      beganWalkRef.current = true;
      navigate({ to: "/walk/active/$id" as never, params: { id: data.id } as never });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start walk");
    } finally { setBusy(false); }
  };

  const openSheet = (type: WalkType) => requireAuth(() => {
    haptics.soft();
    setWalkType(type);
    setPickGuide(false);
    beganWalkRef.current = false;
    setSheetOpen(true);
    if (type !== "audio") void ambient.start();
  });

  const handleSheetChange = (v: boolean) => {
    setSheetOpen(v);
    if (!v) {
      setPickGuide(false);
      if (!beganWalkRef.current) ambient.stop(600);
    }
  };

  const proceed = () => {
    if (walkType === "guided_solo") setPickGuide(true);
    else beginWalk();
  };

  // HomeRoute already handles loading + signed-out + demo branches.
  // If we somehow reach here without a user (defensive), render nothing.
  if (!user) return null;

  const hour = new Date().getHours();
  const greet = hour < 5 ? "A late night walk?" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const name = (user.user_metadata?.display_name as string | undefined)?.split(" ")[0] || "";
  const initials = (user.user_metadata?.display_name as string | undefined)?.charAt(0).toUpperCase()
    || user.email?.charAt(0).toUpperCase() || "?";
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
      {/* Pull-to-refresh indicator */}
      {(pull > 0 || refreshing) && (
        <div className="pointer-events-none fixed inset-x-0 top-12 z-30 flex justify-center">
          <div
            className="rounded-full bg-card/90 px-3 py-1 text-[11px] font-medium text-forest shadow-soft backdrop-blur transition"
            style={{ transform: `translateY(${Math.min(24, pull * 24)}px)`, opacity: refreshing ? 1 : Math.min(1, pull) }}
          >
            {refreshing ? "refreshing…" : pull >= 1 ? "release" : "pull"}
          </div>
        </div>
      )}

      <StickyWeekBar minutes={weeklyMinutes} goal={90} watchId="weekly-card" />

      <div className="space-y-5">
        <HeroBand
          greeting={greet}
          name={name}
          microState={microState}
          level={stats.loading ? null : stats.level}
          initials={initials}
        />

        {activeWalkId && (
          <Link to={"/walk/active/$id" as never} params={{ id: activeWalkId } as never} className="flex items-center justify-between gap-3 rounded-2xl border border-forest/40 bg-accent/40 p-4 transition hover:-translate-y-px">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-forest">Walk in progress</div>
              <div className="font-serif text-base">Continue where you left off</div>
            </div>
            <Play className="h-5 w-5 text-forest" />
          </Link>
        )}

        <ComebackNudge userId={user.id} onStart={() => openSheet("solo")} />

        <StartCta onStart={() => openSheet("solo")} onLongPress={() => openSheet("solo")} />

        {/* Other ways to walk — snap-scroll chip row */}
        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Other ways to walk</div>
          <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0">
            <ModePill icon={Sparkles} label="Guided" onClick={() => openSheet("guided_solo")} />
            <ModePill icon={Headphones} label="Walk & Talk" onClick={() => openSheet("audio")} />
            <ModePill icon={MapPin} label="Local Walks" onClick={() => navigate({ to: "/events" as never })} />
          </div>
        </div>

        <UpcomingFriendWalks />

        <LiveNowStrip
          onJoinAudio={() => openSheet("audio")}
          onStartAudio={() => openSheet("audio")}
        />

        <Card id="weekly-card" className="rounded-2xl border-border bg-card p-5 shadow-soft">
          <WeeklyRing
            minutes={weeklyMinutes}
            dots={weeklyDots}
            footerSlot={
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {streak > 0 ? (
                    <><span className="font-medium text-forest tabular-nums">{streak}-day</span> streak · rest is part of walking.</>
                  ) : (
                    <>Rest is part of walking.</>
                  )}
                </span>
                <InlineWeatherChip />
              </div>
            }
          />
        </Card>

        <WeatherModule />

        <TonightInYourGroups />

        <WeekInReview userId={user.id} />

        {lastReflection && (
          <figure className="px-1 pt-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">From your last walk</div>
            <blockquote className="mt-1 font-serif text-base italic leading-snug text-foreground/85 text-pretty before:mr-1 before:text-forest before:content-['“'] after:text-forest after:content-['”']">{lastReflection}</blockquote>
          </figure>
        )}
      </div>

      <PreWalkSheet
        open={sheetOpen}
        onOpenChange={handleSheetChange}
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

/** Tiny weather chip embedded in the This-Week card. Tap → scroll to full module. */
function InlineWeatherChip() {
  const { coords } = useGeolocation({ autoRequest: false, ipFallback: true });
  const { data } = useCurrentWeather(coords);
  if (!data) return null;
  return (
    <button
      type="button"
      onClick={() => {
        haptics.tap();
        document.getElementById("weather-module")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
      className="shrink-0 transition active:scale-95"
      aria-label="See weather"
    >
      <WeatherPill tempF={data.tempF} label={data.label} tone={data.tone} isDay={data.isDay} />
    </button>
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

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-1 text-left">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-forest/80">Start a walk</div>
          <DrawerTitle className="mt-1 font-serif text-2xl text-balance">Choose how you want to walk</DrawerTitle>
          <p className="mt-1 text-sm italic text-muted-foreground">{MODE_PREFACE[walkType]}</p>
        </DrawerHeader>

        {pickGuide ? (
          <div className="px-4 pb-6">
            <GuidePicker mood={feeling || null} onChoose={onChooseTrack} onSkip={onSkipGuide} />
          </div>
        ) : (
          <>
            <div className="space-y-5 overflow-y-auto px-4 pb-3">
              <div className="grid grid-cols-3 gap-2">
                {([
                  { t: "solo" as const, icon: Footprints, label: "Solo", body: "Just you." },
                  { t: "audio" as const, icon: Headphones, label: "Walk & Talk", body: "Live audio." },
                  { t: "guided_solo" as const, icon: Sparkles, label: "Guided", body: "A voice with you." },
                ]).map(({ t, icon: Icon, label, body }) => {
                  const active = walkType === t;
                  return (
                    <button
                      key={t}
                      onClick={() => { setWalkType(t); haptics.tap(); }}
                      className={`flex min-h-[88px] flex-col items-start gap-1 rounded-2xl border p-3 text-left transition active:scale-[0.98] ${active ? "border-forest bg-accent/60 ring-2 ring-forest/30 shadow-soft" : "border-border bg-card hover:border-forest/40"}`}
                    >
                      <Icon className={`h-4 w-4 ${active ? "text-forest" : "text-muted-foreground"}`} />
                      <span className={`text-sm font-medium ${active ? "text-forest" : "text-foreground"}`}>{label}</span>
                      <span className="text-[11px] leading-tight text-muted-foreground">{body}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => { onOpenChange(false); }}
                className="-mt-1 block text-xs italic text-muted-foreground underline-offset-4 hover:text-forest hover:underline"
              >
                Looking for an in-person Local Walk? Browse Events →
              </button>

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
    <button onClick={onClick} className="flex shrink-0 snap-start items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm shadow-soft transition active:scale-95 hover:-translate-y-px hover:border-forest/50">
      <Icon className="h-4 w-4 text-forest" />
      {label}
    </button>
  );
}

function StartCta({ onStart, onLongPress }: { onStart: () => void; onLongPress?: () => void }) {
  const live = useLiveCount();
  const timer = useRef<number | null>(null);
  const fired = useRef(false);

  const onPressDown = () => {
    fired.current = false;
    if (!onLongPress) return;
    timer.current = window.setTimeout(() => {
      fired.current = true;
      haptics.success();
      onLongPress();
    }, 480);
  };
  const onPressUp = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  };
  const onClick = () => { if (!fired.current) onStart(); };

  return (
    <div className="relative">
      <Button
        onClick={onClick}
        onPointerDown={onPressDown}
        onPointerUp={onPressUp}
        onPointerLeave={onPressUp}
        onPointerCancel={onPressUp}
        className="breathe relative h-16 w-full rounded-2xl bg-forest text-base font-medium text-primary-foreground shadow-soft transition active:scale-[0.98] hover:opacity-90"
      >
        <Footprints className="mr-2 h-5 w-5" /> Start a walk
      </Button>
      {live > 0 && (
        <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest/60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-forest" />
          </span>
          <span><span className="font-medium text-forest tabular-nums">{live}</span> walking &amp; talking now</span>
        </div>
      )}
    </div>
  );
}

