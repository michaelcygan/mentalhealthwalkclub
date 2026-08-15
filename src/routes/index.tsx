import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Footprints, CalendarPlus, BookHeart, Sparkles, MapPin } from "lucide-react";
import { AmbientBackdrop } from "@/components/home/ambient-backdrop";
import { TodayIsland } from "@/components/home/today-island";
import { UpcomingRail } from "@/components/home/upcoming-rail";
import { BestWindow } from "@/components/home/best-window";
import { Reflect30s } from "@/components/home/reflect-30s";
import { WeekSummary } from "@/components/home/week-summary";
import { WeatherForecast } from "@/components/home/weather-forecast";
import { FriendPulse } from "@/components/home/friend-pulse";
import { RadioRail } from "@/components/home/radio-rail";

import { Shimmer } from "@/components/ui/shimmer";
import { WalkCard, type WalkCardData } from "@/components/discover/walk-card";
import { nearbyWalksPublic } from "@/lib/nearby.functions";
import { publicWalkBoard, type PublicBoardWalk } from "@/lib/public-utility.functions";
import { PublicWalkBoard } from "@/components/public/walk-board";

const SITE_URL = "https://mentalhealthwalkclub.com";
const SITE_DESC =
  "Find community walks near you, post your own, and RSVP — no account needed to look around.";
const OG_DEFAULT = "https://mentalhealthwalkclub.com/__l5e/assets-v1/a9e1c704-8b35-4af9-8a3b-6571b05a857e/og-default-v4.jpg";

export const Route = createFileRoute("/")({
  component: HomeRoute,
  loader: () => publicWalkBoard({ data: { radiusMiles: 25, horizonHours: 720, limit: 24 } }),
  head: () => ({
    meta: [
      { title: "Mental Health Walk Club — walks near you" },
      { name: "description", content: SITE_DESC },
      { property: "og:title", content: "Mental Health Walk Club — walks near you" },
      { property: "og:description", content: SITE_DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: OG_DEFAULT },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Mental Health Walk Club — walks near you" },
      { name: "twitter:description", content: SITE_DESC },
      { name: "twitter:image", content: OG_DEFAULT },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
  }),
});

/** Board rows are display-safe; widen them for the member walk cards. */
function toCardData(walks: PublicBoardWalk[]): WalkCardData[] {
  return walks.map((w) => ({
    ...w,
    neighborhood: null,
    audience_mode: "public",
    visibility: "public",
    host_user_id: null,
  }));
}

function HomeRoute() {
  const { user, loading } = useAuth();
  const initial = Route.useLoaderData();

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Shimmer className="h-48 w-full" rounded="rounded-3xl" />
        <Shimmer className="h-32 w-full" />
      </div>
    );
  }

  if (!user) return <LoggedOutHome initialWalks={initial.walks} />;

  return (
    <>
      <AmbientBackdrop />
      <HomeTab initialWalks={toCardData(initial.walks)} />
    </>
  );
}

function LoggedOutHome({ initialWalks }: { initialWalks: PublicBoardWalk[] }) {
  return (
    <div className="space-y-10 py-6">
      <PublicWalkBoard
        initialWalks={initialWalks}
        heading="Find a walk near you"
        subheading="Community walks in real places, posted by real people. Look around — no account needed."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <ValueCard icon={CalendarPlus} title="Post a walk" body="Pick a place and time. Get a sharable page you can drop in a group chat or story." />
        <ValueCard icon={Footprints} title="Walk together" body="RSVP, follow, and keep a small group walking every week." />
        <ValueCard icon={BookHeart} title="Keep memory" body="Photos and reflections from each walk — for you and the people who came." />
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-forest/90 to-forest p-8 text-primary-foreground shadow-soft">
        <h2 className="font-serif text-2xl leading-tight md:text-3xl">
          You don't have to walk through it alone.
        </h2>
        <p className="mt-3 max-w-md text-sm opacity-90 md:text-base">
          Making an account adds groups, a private journal, Radio, and the people you walk with.
        </p>
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

function HomeTab({ initialWalks }: { initialWalks: WalkCardData[] }) {
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

  const { data: homeCity } = useQuery({
    queryKey: ["home", "profile-city", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("city")
        .eq("id", user!.id)
        .maybeSingle();
      const c = (data?.city as string | null | undefined) ?? null;
      return c && c.trim() ? c.trim() : null;
    },
  });

  if (!user) return null;

  return (
    <div className="space-y-6 pb-20">
      <TodayIsland user={user} />
      <UpcomingRail />
      <NearbyGrid
        initialWalks={initialWalks}
        subtitle="Public walks within reach"
        homeCity={homeCity ?? null}
      />
      <RadioRail />
      <BestWindow />
      <Reflect30s lastReflection={lastReflection} />
      <WeekSummary />
      <FriendPulse />
      <WeatherForecast />
      
      <p className="pt-2 text-center font-serif text-xs italic text-muted-foreground">
        Still here. Still walking.{" "}
        <Link to="/journal" className="underline-offset-2 hover:underline">Journal</Link>
      </p>
    </div>
  );
}


function NearbyGrid({
  initialWalks,
  subtitle,
  publicMode = false,
  homeCity = null,
}: {
  initialWalks: WalkCardData[];
  subtitle: string;
  publicMode?: boolean;
  homeCity?: string | null;
}) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoResolved, setGeoResolved] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoResolved(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setGeoResolved(true); },
      () => setGeoResolved(true),
      { maximumAge: 5 * 60_000, timeout: 4_000 },
    );
  }, []);

  const hasLocation = homeCity != null || coords != null;
  const { data, isLoading } = useQuery({
    queryKey: ["home", "nearby", homeCity ?? null, coords?.lat ?? null, coords?.lng ?? null],
    enabled: geoResolved && hasLocation,
    staleTime: 60_000,
    queryFn: () =>
      nearbyWalksPublic({
        data: {
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          city: homeCity ?? null,
          hours: 72,
          limit: 8,
        },
      }),
  });

  const walks = (data?.walks ?? initialWalks) as WalkCardData[];
  const showLoader = hasLocation && isLoading && !data;
  const needsHomeCity = !publicMode && !homeCity && geoResolved && coords == null;

  const heading = hasLocation ? "Walks near you" : "Upcoming walks";
  const sub = homeCity
    ? `In ${homeCity}${coords ? " · plus within 25 mi" : ""}`
    : coords
      ? `Within 25 mi · ${subtitle}`
      : subtitle;

  return (
    <section aria-labelledby="nearby-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id="nearby-heading" className="flex items-center gap-2 font-serif text-lg">
            <Sparkles className="h-4 w-4 text-forest" />
            {heading}
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
        </div>
        {!publicMode && (
          <Link to="/walk/new" className="shrink-0 text-[11px] text-forest underline">
            Post a walk
          </Link>
        )}
      </div>

      {showLoader ? (
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-52 w-[78vw] max-w-[320px] shrink-0 animate-pulse rounded-3xl bg-card" />
          ))}
        </div>
      ) : walks.length === 0 ? (
        needsHomeCity ? <EmptyNoHomeCity /> : <EmptyNearby publicMode={publicMode} />
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {walks.map((w) => (
            <WalkCard key={w.id} walk={w} variant="cover" hideRsvp={publicMode} />
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyNearby({ publicMode }: { publicMode: boolean }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center">
      <MapPin className="mx-auto h-5 w-5 text-forest" />
      <p className="mt-2 text-sm font-medium">No walks posted yet.</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {publicMode ? "Sign up and plant the first flag in your area." : "Plant the first flag for tonight or this weekend."}
      </p>
    </div>
  );
}

function EmptyNoHomeCity() {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center">
      <MapPin className="mx-auto h-5 w-5 text-forest" />
      <p className="mt-2 text-sm font-medium">Set your home city to see walks near you.</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        We'll show upcoming walks in your area.
      </p>
      <Link
        to="/settings"
        className="mt-3 inline-block rounded-full bg-forest px-4 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-95"
      >
        Set home city
      </Link>
    </div>
  );
}

