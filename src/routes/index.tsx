import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Footprints, CalendarPlus, BookHeart } from "lucide-react";
import { AmbientBackdrop } from "@/components/home/ambient-backdrop";
import { TodayIsland } from "@/components/home/today-island";
import { UpcomingRail } from "@/components/home/upcoming-rail";
import { BestWindow } from "@/components/home/best-window";
import { Reflect30s } from "@/components/home/reflect-30s";
import { WeekSummary } from "@/components/home/week-summary";
import { WeatherForecast } from "@/components/home/weather-forecast";
import { FriendPulse } from "@/components/home/friend-pulse";
import { ListenAndRead } from "@/components/home/listen-and-read";
import { Shimmer } from "@/components/ui/shimmer";

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
        <Shimmer className="h-48 w-full" rounded="rounded-3xl" />
        <Shimmer className="h-32 w-full" />
      </div>
    );
  }

  if (!user) return <LoggedOutHome onSignUp={() => openAuth("signup")} onSignIn={() => openAuth("signin")} />;
  return (
    <>
      <AmbientBackdrop />
      <HomeTab />
    </>
  );
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

function HomeTab() {
  const { user } = useAuth();
  const { data: lastReflection } = useQuery({
    queryKey: ["home", "last-reflection", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 30); since.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("walk_sessions")
        .select("reflection_note,started_at,status")
        .eq("user_id", user!.id)
        .eq("status", "completed")
        .not("reflection_note", "is", null)
        .gte("started_at", since.toISOString())
        .order("started_at", { ascending: false })
        .limit(1);
      return (data?.[0]?.reflection_note as string | undefined) ?? null;
    },
  });

  if (!user) return null;

  return (
    <div className="space-y-4 pb-20">
      <TodayIsland user={user} />
      <UpcomingRail />
      <BestWindow />
      <Reflect30s lastReflection={lastReflection} />
      <WeekSummary />
      <FriendPulse />
      <WeatherForecast />
      <ListenAndRead />
      <p className="pt-2 text-center font-serif text-xs italic text-muted-foreground">
        Still here. Still walking.{" "}
        <Link to="/journal" className="underline-offset-2 hover:underline">Journal</Link>
      </p>
    </div>
  );
}
