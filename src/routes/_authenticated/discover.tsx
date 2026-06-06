import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Globe, MapPin, Users, Footprints, TreePine } from "lucide-react";
import { discoverNearbyWalks } from "@/lib/discover.functions";
import { discoverPublicGroups } from "@/lib/groups.functions";
import { discoverPlaces } from "@/lib/places.functions";
import { discoverTrails } from "@/lib/trails.functions";

export const Route = createFileRoute("/_authenticated/discover")({
  component: DiscoverPage,
  head: () => ({
    meta: [
      { title: "Discover — Mental Health Walk Club" },
      { name: "description", content: "Walks, groups, places and trails near you." },
    ],
  }),
});

type Walk = {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  venue_name: string | null;
  city: string | null;
  image_url: string | null;
  miles: number | null;
  attendee_count: number;
  audience_mode: string;
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

function DiscoverPage() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<"asking" | "ok" | "denied">("asking");
  const [walks, setWalks] = useState<Walk[]>([]);
  const [localGroups, setLocalGroups] = useState<GroupRow[]>([]);
  const [globalGroups, setGlobalGroups] = useState<GroupRow[]>([]);
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
      const [w, lg, gg, pl] = await Promise.all([
        discoverNearbyWalks({ data: { lat: coords?.lat ?? null, lng: coords?.lng ?? null, hours: 48, limit: 4 } }),
        discoverPublicGroups({ data: { lat: coords?.lat ?? null, lng: coords?.lng ?? null, scope: "local" } }),
        discoverPublicGroups({ data: { lat: null, lng: null, scope: "global" } }),
        discoverPlaces({ data: { lat: coords?.lat ?? null, lng: coords?.lng ?? null, scope: "local" } }),
      ]);
      setWalks(w.walks as Walk[]);
      setLocalGroups(lg.groups.slice(0, 3));
      setGlobalGroups(gg.groups.slice(0, 3));
      setPlaces(pl.places.slice(0, 4));
      setLoading(false);
      if (coords) {
        try {
          const t = await discoverTrails({ data: { lat: coords.lat, lng: coords.lng, limit: 4 } });
          setTrails(t.trails as TrailRow[]);
        } catch {
          setTrails([]);
        }
      }
    })();
  }, [coords, geoState]);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <header className="mb-6">
        <h1 className="font-serif text-3xl">Discover</h1>
        <p className="mt-1 text-sm text-muted-foreground">Walks, groups, and quiet places to meet.</p>
      </header>

      {geoState === "denied" && (
        <div className="mb-5 rounded-2xl border border-dashed border-border bg-card/60 p-4 text-xs">
          <p className="font-medium">Turn on location for nearby picks.</p>
          <p className="mt-1 text-muted-foreground">
            We'll only use it to show what's within 25 miles. Showing global groups for now.
          </p>
        </div>
      )}

      <div className="space-y-7">
        <Rail
          icon={<Footprints className="h-4 w-4" />}
          title={coords ? "Tonight near you" : "Coming up"}
          subtitle={coords ? "Within 25mi · next 48 hours" : "Next 48 hours"}
          seeAllTo="/walk/new"
          loading={loading}
          empty="No walks scheduled yet. Be the first to host one."
          items={walks}
          render={(w) => (
            <Link
              to="/w/$code"
              params={{ code: w.slug }}
              className="block rounded-3xl border border-border bg-card p-4 shadow-soft transition hover:bg-accent/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-serif text-base">{w.title}</h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {formatWhen(w.starts_at)}
                    </span>
                    {(w.venue_name || w.city) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {w.venue_name ?? w.city}
                      </span>
                    )}
                    {w.miles != null && <span>· {w.miles.toFixed(1)} mi</span>}
                    {w.audience_mode === "group" && (
                      <span className="rounded-full bg-forest/10 px-1.5 py-0.5 text-[10px] text-forest">group</span>
                    )}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          )}
        />

        <Rail
          icon={<Users className="h-4 w-4" />}
          title={coords ? "Groups near you" : "Recent public groups"}
          subtitle={coords ? "Standing walks within 25mi" : "Discoverable groups"}
          seeAllTo="/groups"
          loading={loading}
          empty="No groups near you yet. Start one?"
          items={localGroups}
          render={(g) => <GroupCard g={g} />}
        />

        <Rail
          icon={<Globe className="h-4 w-4" />}
          title="Global identity groups"
          subtitle="Postpartum walkers, sober strolls, grief & movement…"
          seeAllTo="/groups"
          loading={loading}
          empty="No global groups yet."
          items={globalGroups}
          render={(g) => <GroupCard g={g} globe />}
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
              className="block rounded-3xl border border-border bg-card p-4 shadow-soft transition hover:bg-accent/30"
            >
              <h3 className="truncate font-serif text-base">{p.label ?? p.neighborhood ?? "Meetup spot"}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {p.group_count} group{p.group_count === 1 ? "" : "s"}
                </span>
                {p.miles != null && <span>· {p.miles.toFixed(1)} mi</span>}
              </div>
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
              className="block rounded-3xl border border-border bg-card p-4 shadow-soft transition hover:bg-accent/30"
            >
              <h3 className="truncate font-serif text-base">{t.name ?? "Unnamed"}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full bg-forest/10 px-1.5 py-0.5 text-forest">{t.kind ?? "trail"}</span>
                {t.miles != null && <span>· {t.miles.toFixed(1)} mi</span>}
              </div>
            </Link>
          )}
        />
      </div>
    </div>
  );
}

function GroupCard({ g, globe }: { g: GroupRow; globe?: boolean }) {
  return (
    <Link
      to="/groups/$slug"
      params={{ slug: g.slug }}
      className="block rounded-3xl border border-border bg-card p-4 shadow-soft transition hover:bg-accent/30"
    >
      <h3 className="truncate font-serif text-base">{g.name}</h3>
      {g.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{g.description}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        {g.neighborhood && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {g.neighborhood}
          </span>
        )}
        {g.miles != null && <span>· {g.miles.toFixed(1)} mi</span>}
        {globe && (
          <span className="inline-flex items-center gap-1">
            <Globe className="h-3 w-3" />
            global
          </span>
        )}
      </div>
    </Link>
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
  seeAllTo: "/events" | "/groups" | "/places" | "/trails";
  items: T[];
  loading: boolean;
  empty: string;
  render: (item: T) => React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-serif text-lg">
            <span className="text-forest">{icon}</span>
            {title}
          </h2>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <Link to={seeAllTo} className="shrink-0 text-[11px] text-forest underline">
          See all
        </Link>
      </header>
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

function formatWhen(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today · ${time}`;
  if (isTomorrow) return `Tomorrow · ${time}`;
  return `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${time}`;
}
