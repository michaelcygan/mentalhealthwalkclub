import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Footprints, CalendarPlus, BookHeart } from "lucide-react";
import { WeatherPill } from "@/components/weather-pill";
import { useCurrentWeather, useGeolocation } from "@/hooks/use-weather";


export const Route = createFileRoute("/")({
  component: HomeRoute,
  head: () => ({ meta: [{ title: "Mental Health Walk Club" }] }),
});

function HomeRoute() {
  const { user, loading } = useAuth();
  const { openAuth } = useAuthPrompt();

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-48 w-full animate-pulse rounded-3xl bg-muted/50" />
        <div className="h-32 w-full animate-pulse rounded-2xl bg-muted/40" />
      </div>
    );
  }

  if (!user) return <LoggedOutHome onSignUp={() => openAuth("signup")} onSignIn={() => openAuth("signin")} />;
  return <WalkTab />;
}

function LoggedOutHome({ onSignUp, onSignIn }: { onSignUp: () => void; onSignIn: () => void }) {
  return (
    <div className="space-y-6 py-6">
      <div className="rounded-3xl bg-gradient-to-br from-forest/90 to-forest p-8 text-primary-foreground shadow-soft">
        <h1 className="font-serif text-3xl leading-tight md:text-4xl">
          You don't have to walk through it alone.
        </h1>
        <p className="mt-3 max-w-md text-sm opacity-90 md:text-base">
          Post a walk, share a beautiful page, and let friends RSVP. A walking club for your circle — built around real meetups.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={onSignUp} className="rounded-full bg-background text-foreground hover:opacity-90">
            Join the club
          </Button>
          <Button onClick={onSignIn} variant="ghost" className="rounded-full text-primary-foreground hover:bg-white/10">
            Sign in
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <ValueCard icon={CalendarPlus} title="Post a walk" body="Pick a place and time. Get a sharable page you can drop in a group chat or story." />
        <ValueCard icon={Footprints} title="Walk solo" body="A quiet timer, weather, mood, and a journal. No tracking, no pressure." />
        <ValueCard icon={BookHeart} title="Keep memory" body="Photos, reflections, and the small details from each walk — for you and the people who came." />
      </div>
    </div>
  );
}

function ValueCard({ icon: Icon, title, body }: { icon: typeof Footprints; title: string; body: string }) {
  return (
    <Card className="rounded-2xl border-border bg-card p-5 shadow-soft">
      <Icon className="h-5 w-5 text-forest" />
      <h3 className="mt-3 font-serif text-base">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </Card>
  );
}

function WalkTab() {
  const { user } = useAuth();
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [weeklyDots, setWeeklyDots] = useState<boolean[]>([false, false, false, false, false, false, false]);
  const [lastReflection, setLastReflection] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const since = new Date(); since.setDate(since.getDate() - 7); since.setHours(0, 0, 0, 0);
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
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const dots = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(today); d.setDate(d.getDate() - (6 - i));
          const next = new Date(d); next.setDate(next.getDate() + 1);
          return rows.some(r => {
            const t = new Date(r.started_at).getTime();
            return t >= d.getTime() && t < next.getTime() && r.status === "completed";
          });
        });
        setWeeklyDots(dots);
        const recent = completed.find(r => r.reflection_note);
        if (recent) setLastReflection(recent.reflection_note);
      });
  }, [user]);

  if (!user) return null;

  const hour = new Date().getHours();
  const greet = hour < 5 ? "A late night walk?" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const name = (user.user_metadata?.display_name as string | undefined)?.split(" ")[0] || "";

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{greet}{name ? "," : ""}</div>
        <h1 className="mt-1 font-serif text-3xl leading-tight">{name || "Welcome back"}</h1>
        <InlineWeatherChip />
      </div>

      <Card className="rounded-2xl border-border bg-card p-5 shadow-soft">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">This week</div>
            <div className="mt-1 font-serif text-2xl tabular-nums">{weeklyMinutes} <span className="text-base text-muted-foreground">min</span></div>
          </div>
          <div className="flex gap-1.5">
            {weeklyDots.map((on, i) => (
              <span key={i} className={`h-6 w-2 rounded-full ${on ? "bg-forest" : "bg-muted"}`} />
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Rest is part of walking.</p>
      </Card>

      <Link
        to="/journal"
        className="block rounded-2xl border border-border bg-card p-4 text-sm shadow-soft transition hover:-translate-y-px hover:border-forest/40"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-medium"><BookHeart className="h-4 w-4 text-forest" /> Journal</span>
          <span className="text-xs text-muted-foreground">View →</span>
        </div>
        {lastReflection && (
          <blockquote className="mt-2 font-serif text-sm italic text-muted-foreground line-clamp-2">"{lastReflection}"</blockquote>
        )}
      </Link>

      <Link
        to="/discover"
        className="block rounded-2xl border border-border bg-card p-4 text-sm shadow-soft transition hover:-translate-y-px hover:border-forest/40"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-medium"><CalendarPlus className="h-4 w-4 text-forest" /> Walks near you</span>
          <span className="text-xs text-muted-foreground">Discover →</span>
        </div>
      </Link>

      <HomeComposeFab />
    </div>
  );
}

function InlineWeatherChip() {
  const { coords } = useGeolocation({ autoRequest: false, ipFallback: true });
  const { data } = useCurrentWeather(coords);
  if (!data) return null;
  return (
    <div className="mt-2 inline-block">
      <WeatherPill tempF={data.tempF} label={data.label} tone={data.tone} isDay={data.isDay} />
    </div>
  );
}
