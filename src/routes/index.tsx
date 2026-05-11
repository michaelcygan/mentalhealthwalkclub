import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Footprints, Headphones, MapPin, Sparkles, Play } from "lucide-react";
import { LiveNowStrip } from "@/components/live-now-strip";
import { UpcomingFriendWalks } from "@/components/friend-walk/upcoming-friend-walks";
import { WeeklyRing } from "@/components/weekly-ring";
import { WeekInReview } from "@/components/week-in-review";
import { ComebackNudge } from "@/components/comeback-nudge";
import { haptics } from "@/lib/device";
import { useWalkComposer } from "@/components/walk-composer/use-walk-composer";

import { HeroBand } from "@/components/home/hero-band";
import { WeatherModule } from "@/components/home/weather-module";
import { StickyWeekBar } from "@/components/home/sticky-week-bar";
import { TonightInYourGroups } from "@/components/home/tonight-in-your-groups";
import { WeatherPill } from "@/components/weather-pill";
import { useCurrentWeather, useGeolocation } from "@/hooks/use-weather";
import { useLiveCount } from "@/hooks/use-live-count";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useProfileStats } from "@/hooks/use-profile-stats";
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
  if (onboarded === false) return <EntryFlow startAtOnboarding onCompleted={markOnboarded} />;
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const composer = useWalkComposer();

  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [weeklyDots, setWeeklyDots] = useState<boolean[]>([false, false, false, false, false, false, false]);
  const [activeWalkId, setActiveWalkId] = useState<string | null>(null);
  const [totalWalks, setTotalWalks] = useState<number | null>(null);
  const [lastReflection, setLastReflection] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const stats = useProfileStats(user?.id);

  // Web Share Target → ?start=1 opens the composer
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    if (u.searchParams.get("start") === "1" || u.searchParams.get("intention") || u.searchParams.get("text") || u.searchParams.get("title")) {
      composer.open({ type: "solo" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const openSheet = (type: WalkType) => composer.open({ type });


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
          <div className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

