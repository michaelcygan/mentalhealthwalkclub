import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  CalendarDays,
  Globe,
  MapPin,
  Users,
  Footprints,
  TreePine,
  Sparkles,
  CircleDot,
  Image,
  HeartHandshake,
  ChevronRight,
  UserPlus,
} from "lucide-react";
import { discoverNearbyWalks, discoverFeaturedEvents, discoverFriendsGoing, discoverMyCircleSummary, discoverMemories } from "@/lib/discover.functions";
import { discoverPublicGroups } from "@/lib/groups.functions";
import { discoverPlaces } from "@/lib/places.functions";
import { discoverTrails } from "@/lib/trails.functions";
import { WalkCard } from "@/components/discover/walk-card";
import { FriendsGoingRow } from "@/components/discover/friends-going-row";
import { CircleRow } from "@/components/discover/circle-row";
import { MemoriesStrip } from "@/components/discover/memories-strip";
import { InviteCard } from "@/components/discover/invite-card";
import type { FriendGoingEvent } from "@/lib/discover.functions";

export const Route = createFileRoute("/_authenticated/discover")({
  component: DiscoverPage,
  head: () => ({
    meta: [
      { title: "Discover — Mental Health Walk Club" },
      { name: "description", content: "Walks, friends, circles, and quiet places to meet." },
    ],
  }),
});

type Walk = {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  timezone: string | null;
  venue_name: string | null;
  city: string | null;
  neighborhood: string | null;
  lat: number | string | null;
  lng: number | string | null;
  attendee_count: number;
  image_url: string | null;
  audience_mode: string;
  visibility: string;
  host_user_id: string | null;
  miles?: number | null;
};

type GroupRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  neighborhood: string | null;
  miles?: number | null;
};

type PlaceRow = {
  key: string;
  label: string | null;
  neighborhood: string | null;
  group_count: number;
  miles: number | null;
};

type TrailRow = {
  id: string;
  name: string | null;
  kind: string | null;
  miles?: number;
};

type CircleSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  member_count: number;
  avatars: Array<{ avatar_url: string | null; display_name: string | null }>;
  active_walkers: number;
  owned_by_me: boolean;
};

type Memory = {
  id: string;
  kind: "walk";
  date: string;
  duration_min: number | null;
  event_id: string | null;
};

type Segment = "for-you" | "walks" | "friends" | "circles" | "more";

const SEGMENTS: Array<{ id: Segment; label: string }> = [
  { id: "for-you", label: "For you" },
  { id: "walks", label: "Walks" },
  { id: "friends", label: "Friends" },
  { id: "circles", label: "Circles" },
  { id: "more", label: "More" },
];

function DiscoverPage() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<"asking" | "ok" | "denied">("asking");
  const [segment, setSegment] = useState<Segment>("for-you");

  const [tonight, setTonight] = useState<Walk[]>([]);
  const [thisWeek, setThisWeek] = useState<Walk[]>([]);
  const [featured, setFeatured] = useState<Walk[]>([]);
  const [friendsGoing, setFriendsGoing] = useState<FriendGoingEvent[]>([]);
  const [circles, setCircles] = useState<CircleSummary[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [localGroups, setLocalGroups] = useState<GroupRow[]>([]);
  const [places, setPlaces] = useState<PlaceRow[]>([]);
  const [trails, setTrails] = useState<TrailRow[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoState("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeoState("ok");
      },
      () => setGeoState("denied"),
      { maximumAge: 60_000, timeout: 4_000 },
    );
  }, []);

  useEffect(() => {
    if (geoState === "asking") return;
    setLoading(true);
    (async () => {
      const [
        tonightRes,
        weekRes,
        featuredRes,
        friendsRes,
        circlesRes,
        memoriesRes,
        groupsRes,
        placesRes,
      ] = await Promise.all([
        discoverNearbyWalks({ data: { lat: coords?.lat ?? null, lng: coords?.lng ?? null, hours: 18, limit: 8 } }),
        discoverNearbyWalks({ data: { lat: coords?.lat ?? null, lng: coords?.lng ?? null, hours: 168, limit: 6 } }),
        discoverFeaturedEvents({ data: { limit: 4 } }),
        discoverFriendsGoing({ data: { limit: 6 } }),
        discoverMyCircleSummary(),
        discoverMemories({ data: { limit: 8 } }),
        discoverPublicGroups({ data: { lat: coords?.lat ?? null, lng: coords?.lng ?? null, scope: "local" } }),
        discoverPlaces({ data: { lat: coords?.lat ?? null, lng: coords?.lng ?? null, scope: "local" } }),
      ]);

      setTonight(tonightRes.walks as Walk[]);
      setThisWeek(weekRes.walks.filter((w) => !tonightRes.walks.some((t) => t.id === w.id)) as Walk[]);
      setFeatured(featuredRes.walks as Walk[]);
      setFriendsGoing(friendsRes.events);
      setCircles(circlesRes.circles as CircleSummary[]);
      setMemories(memoriesRes.memories as Memory[]);
      setLocalGroups(groupsRes.groups.slice(0, 4) as GroupRow[]);
      setPlaces(placesRes.places.slice(0, 4) as PlaceRow[]);

      if (coords) {
        try {
          const t = await discoverTrails({ data: { lat: coords.lat, lng: coords.lng, limit: 4 } });
          setTrails(t.trails as TrailRow[]);
        } catch {
          setTrails([]);
        }
      }

      setLoading(false);
    })();
  }, [coords, geoState]);

  const showTonight = segment === "for-you" || segment === "walks";
  const showThisWeek = segment === "for-you" || segment === "walks";
  const showFeatured = segment === "for-you";
  const showFriends = segment === "for-you" || segment === "friends";
  const showCircles = segment === "for-you" || segment === "circles";
  const showMemories = segment === "for-you";
  const showInvite = segment === "for-you";
  const showMore = segment === "more";
  const nearbyCount = tonight.length + thisWeek.length;
  const socialCount = friendsGoing.length + circles.length;
  const isColdStart = !loading && nearbyCount === 0 && socialCount === 0;
  const isDense = !loading && (nearbyCount >= 8 || friendsGoing.length >= 4 || circles.length >= 4);

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <header className="mb-4">
        <h1 className="font-serif text-3xl">Discover</h1>
        <p className="mt-1 text-sm text-muted-foreground">Walks, friends, and your circles.</p>
      </header>

      {/* Sticky segmented island */}
      <div className="sticky top-[calc(env(safe-area-inset-top)+52px)] z-20 -mx-1 mb-5 px-1 md:top-0 md:mb-6">
        <div
          role="tablist"
          aria-label="Filter discover"
          className="relative flex items-center gap-1 overflow-x-auto rounded-full border border-border/60 bg-background/75 p-1 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/55 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SEGMENTS.map((s) => {
            const active = segment === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSegment(s.id)}
                className={`relative shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition ${
                  active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="discover-segment-pill"
                    className="absolute inset-0 rounded-full bg-forest shadow-soft"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {geoState === "denied" && segment === "for-you" && (
        <div className="mb-5 rounded-2xl border border-dashed border-border bg-card/60 p-4 text-xs">
          <p className="font-medium">Turn on location for nearby picks.</p>
          <p className="mt-1 text-muted-foreground">
            We'll only use it to show what's within 25 miles.
          </p>
        </div>
      )}

      <div className="space-y-8">
        {segment === "for-you" && isColdStart && (
          <section className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-soft">
            <div className="px-5 pb-4 pt-5">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-forest">New around here</p>
              <h2 className="mt-2 max-w-sm font-serif text-2xl leading-tight">A good walk can start with one person—or one plan.</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                There’s nothing nearby yet. You can invite someone into the club, or post the first walk in your area.
              </p>
            </div>
            <div className="grid grid-cols-2 border-t border-border">
              <a href="#invite-someone" className="group min-h-28 border-r border-border p-4 transition hover:bg-accent/30">
                <UserPlus className="h-5 w-5 text-forest" />
                <p className="mt-5 text-sm font-medium">Invite someone</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Text or send a link</p>
              </a>
              <Link to="/walk/new" className="group min-h-28 p-4 transition hover:bg-accent/30">
                <CalendarDays className="h-5 w-5 text-forest" />
                <p className="mt-5 text-sm font-medium">Plan a walk</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Post it, then invite people</p>
              </Link>
            </div>
          </section>
        )}

        {/* Tonight near you */}
        {showTonight && !isColdStart && (
          <section>
            <SectionHeader
              icon={<Sparkles className="h-4 w-4" />}
              title={coords ? "Tonight near you" : "Coming up"}
              subtitle={coords ? "Within 25mi · next 18 hours" : "Next 18 hours"}
              action={
                <Link to="/walk/new" className="shrink-0 text-[11px] text-forest underline">
                  Plan a walk
                </Link>
              }
            />
            {loading ? (
              <div className="flex gap-3 overflow-hidden">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-52 w-[78vw] max-w-[320px] shrink-0 animate-pulse rounded-3xl bg-card" />
                ))}
              </div>
            ) : tonight.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card/60 p-5 text-center text-xs text-muted-foreground">
                No walks posted yet. Plant the flag for tonight.
              </div>
            ) : (
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {tonight.map((w) => (
                  <WalkCard key={w.id} walk={w} variant="cover" />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Friends are going */}
        {showFriends && (!isColdStart || segment === "friends") && (
          <section>
            <SectionHeader
              icon={<HeartHandshake className="h-4 w-4" />}
              title="Friends are going"
              subtitle="People you know are showing up"
            />
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-2xl bg-card" />
                ))}
              </div>
            ) : friendsGoing.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card/60 p-5 text-center text-xs text-muted-foreground">
                No friend activity yet. Add friends to see when they're walking.
              </div>
            ) : (
              <div className="space-y-2.5">
                {friendsGoing.map((e) => (
                  <FriendsGoingRow key={e.id} event={e} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Your circles */}
        {showCircles && (!isColdStart || segment === "circles") && (
          <section>
            <SectionHeader
              icon={<CircleDot className="h-4 w-4" />}
              title="Your circles"
              subtitle="Small groups for the walks that matter"
              action={
                <Link to="/circles" className="shrink-0 text-[11px] text-forest underline">
                  Manage
                </Link>
              }
            />
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-2xl bg-card" />
                ))}
              </div>
            ) : circles.length === 0 ? (
              <Link to="/circles" className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 text-sm shadow-soft">
                <span>Make a private circle after your people join.</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ) : (
              <div className="space-y-2.5">
                {circles.map((c) => (
                  <CircleRow key={c.id} circle={c} />
                ))}
                <Link
                  to="/circles"
                  className="flex items-center justify-center gap-1 rounded-2xl border border-dashed border-border bg-card/40 p-3 text-[11px] text-muted-foreground transition hover:bg-accent/20"
                >
                  <CircleDot className="h-3 w-3" /> Create a new circle
                </Link>
              </div>
            )}
          </section>
        )}

        {/* Featured this week */}
        {showFeatured && (
          <section>
            <SectionHeader
              icon={<Sparkles className="h-4 w-4" />}
              title="Featured this week"
              subtitle="Curated walks worth knowing about"
              action={
                featured.length > 0 ? (
                  <span className="shrink-0 rounded-full bg-forest/10 px-2 py-0.5 text-[10px] text-forest">Featured</span>
                ) : null
              }
            />
            {loading ? (
              <div className="flex gap-3 overflow-hidden">
                {[0, 1].map((i) => (
                  <div key={i} className="h-52 w-[78vw] max-w-[320px] shrink-0 animate-pulse rounded-3xl bg-card" />
                ))}
              </div>
            ) : featured.length === 0 ? null : (
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {featured.map((w) => (
                  <WalkCard key={w.id} walk={w} variant="cover" />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Memories */}
        {showMemories && memories.length > 0 && (
          <section>
            <SectionHeader
              icon={<Image className="h-4 w-4" />}
              title="Memories"
              subtitle="Recent walks you've taken"
            />
            <MemoriesStrip memories={memories} />
          </section>
        )}

        {/* This week near you */}
        {showThisWeek && !isColdStart && (
          <section>
            <SectionHeader
              icon={<CalendarDays className="h-4 w-4" />}
              title="This week near you"
              subtitle="Next 7 days"
            />
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-2xl bg-card" />
                ))}
              </div>
            ) : thisWeek.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card/60 p-5 text-center text-xs text-muted-foreground">
                No walks this week yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {thisWeek.map((w) => (
                  <WalkCard key={w.id} walk={w} variant="list" />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Walk together invite */}
        {showInvite && (!isDense || isColdStart) && (
          <div id="invite-someone" className="scroll-mt-36">
            <InviteCard />
          </div>
        )}

        {/* More: Groups, Places, Trails */}
        {showMore && (
          <div className="space-y-7">
            <Rail
              icon={<Users className="h-4 w-4" />}
              title={coords ? "Groups near you" : "Recent public groups"}
              subtitle={coords ? "Standing walks within 25mi" : "Discoverable groups"}
              seeAllTo="/groups"
              loading={loading}
              empty="No groups near you yet. Start one?"
              items={localGroups}
              render={(g) => (
                <Link
                  to="/groups/$slug"
                  params={{ slug: g.slug }}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:bg-accent/30"
                >
                  <div>
                    <h3 className="font-serif text-base">{g.name}</h3>
                    {g.description && <p className="mt-0.5 text-xs text-muted-foreground">{g.description}</p>}
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      {g.neighborhood && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{g.neighborhood}</span>}
                      {g.miles != null && <span>· {g.miles.toFixed(1)} mi</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              )}
            />

            <Rail
              icon={<MapPin className="h-4 w-4" />}
              title="Places to meet"
              subtitle="Parks and corners where standing walks happen"
              seeAllTo="/places"
              loading={loading}
              empty="No meetup spots yet."
              items={places}
              render={(p) => (
                <Link
                  to="/places/$key"
                  params={{ key: p.key }}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:bg-accent/30"
                >
                  <div>
                    <h3 className="font-serif text-base">{p.label ?? p.neighborhood ?? "Meetup spot"}</h3>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{p.group_count} group{p.group_count === 1 ? "" : "s"}</span>
                      {p.miles != null && <span>· {p.miles.toFixed(1)} mi</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              )}
            />

            <Rail
              icon={<TreePine className="h-4 w-4" />}
              title="Trails near you"
              subtitle="Parks and footpaths from OpenStreetMap"
              seeAllTo="/trails"
              loading={loading}
              empty={coords ? "No trails found nearby yet." : "Turn on location to see trails."}
              items={trails}
              render={(t) => (
                <Link
                  to="/trails"
                  className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:bg-accent/30"
                >
                  <div>
                    <h3 className="font-serif text-base">{t.name ?? "Unnamed"}</h3>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded-full bg-forest/10 px-1.5 py-0.5 text-forest">{t.kind ?? "trail"}</span>
                      {t.miles != null && <span>· {t.miles.toFixed(1)} mi</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-serif text-lg">
          <span className="text-forest">{icon}</span>
          {title}
        </h2>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function Rail<T>({
  icon,
  title,
  subtitle,
  seeAllTo,
  items,
  loading,
  empty,
  render,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  seeAllTo: "/groups" | "/places" | "/trails";
  items: T[];
  loading: boolean;
  empty: string;
  render: (item: T) => React.ReactNode;
}) {
  return (
    <section>
      <SectionHeader icon={icon} title={title} subtitle={subtitle} action={<Link to={seeAllTo} className="shrink-0 text-[11px] text-forest underline">See all</Link>} />
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-card" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 p-5 text-center text-xs text-muted-foreground">
          {empty}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((it, i) => (
            <li key={i}>{render(it)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
