import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { MapPin, ExternalLink, Loader2, AlertCircle, Users, Lock, Globe } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { WalkCard, type WalkCardData } from "@/components/discover/walk-card";
import { discoverNearbyWalks } from "@/lib/discover.functions";
import { listMyGroups, discoverPublicGroups } from "@/lib/groups.functions";
import { discoverTrails } from "@/lib/trails.functions";

type Tab = "walks" | "groups" | "places";

const searchSchema = z.object({
  tab: z.enum(["walks", "groups", "places"]).catch("walks").default("walks"),
});

export const Route = createFileRoute("/_authenticated/discover")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Discover — Mental Health Walk Club" },
      {
        name: "description",
        content: "Find upcoming walks, walking groups, parks, and paths near you.",
      },
      { property: "og:title", content: "Discover — Mental Health Walk Club" },
      {
        property: "og:description",
        content: "Find upcoming walks, walking groups, parks, and paths near you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiscoverPage,
});

/* ---------- Location hook (page-local, non-blocking) ---------- */

type Coords = { lat: number; lng: number } | null;
type LocStatus = "idle" | "requesting" | "granted" | "denied" | "unsupported";

function useDiscoverLocation() {
  const [coords, setCoords] = useState<Coords>(null);
  const [status, setStatus] = useState<LocStatus>("idle");

  const request = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    setStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("granted");
      },
      () => setStatus("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  };

  // Best-effort auto-request once on mount; page still renders without it.
  useEffect(() => {
    request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { coords, status, request };
}

/* ---------- Page ---------- */

function DiscoverPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { coords, status, request } = useDiscoverLocation();

  const setTab = (next: Tab) => {
    navigate({ search: (prev: { tab: Tab }) => ({ ...prev, tab: next }), replace: true });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <header className="mb-4">
        <h1 className="font-serif text-3xl leading-tight">Discover</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Walks, groups, and places near you.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Discover sections"
        className="sticky top-14 z-20 -mx-4 mb-4 flex gap-1 border-b border-border bg-background/85 px-4 py-2 backdrop-blur md:top-0"
      >
        {(["walks", "groups", "places"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-4 py-2 text-sm capitalize transition ${
              tab === t
                ? "bg-forest text-cream shadow-soft"
                : "text-muted-foreground hover:bg-accent/40"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <LocationStatus status={status} coords={coords} onRequest={request} />

      <div className="mt-4">
        {tab === "walks" && <WalksSegment coords={coords} />}
        {tab === "groups" && <GroupsSegment coords={coords} />}
        {tab === "places" && (
          <PlacesSegment coords={coords} status={status} onRequest={request} />
        )}
      </div>
    </div>
  );
}

function LocationStatus({
  status,
  coords,
  onRequest,
}: {
  status: LocStatus;
  coords: Coords;
  onRequest: () => void;
}) {
  if (coords) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <MapPin className="h-3 w-3" /> Using your location
      </p>
    );
  }
  if (status === "requesting") {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Finding your location…
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
      <span>Turn on location for nearby distances.</span>
      <Button size="sm" variant="ghost" className="h-6 rounded-full px-2 text-[11px]" onClick={onRequest}>
        Use location
      </Button>
    </div>
  );
}

/* ---------- Shared UI primitives ---------- */

function SectionLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex items-center gap-2 rounded-2xl border border-border bg-card/60 p-5 text-sm text-muted-foreground"
    >
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

function SectionError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="flex-1">
        <p>{message ?? "Something went wrong."}</p>
        {onRetry && (
          <Button size="sm" variant="ghost" className="mt-2 h-7 rounded-full px-3" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 font-serif text-lg">{children}</h2>;
}

/* ---------- Walks ---------- */

type TimeFilter = "today" | "week";
type DistFilter = 5 | 10 | 25;

function WalksSegment({ coords }: { coords: Coords }) {
  const [time, setTime] = useState<TimeFilter>("week");
  const [dist, setDist] = useState<DistFilter>(25);

  const query = useQuery({
    queryKey: ["discover", "walks", coords?.lat ?? null, coords?.lng ?? null],
    queryFn: () =>
      discoverNearbyWalks({
        data: {
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          hours: 168,
          limit: 20,
        },
      }),
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const walks = (query.data?.walks ?? []) as WalkCardData[];
    return walks.filter((w) => {
      // Time
      const start = new Date(w.starts_at);
      if (time === "today") {
        const now = new Date();
        const tz = w.timezone ?? undefined;
        const fmt = (d: Date) =>
          new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
        if (fmt(start) !== fmt(now)) return false;
      }
      // Distance
      if (dist < 25) {
        if (w.miles == null) return false;
        if (w.miles > dist) return false;
      }
      return true;
    });
  }, [query.data, time, dist]);

  return (
    <section aria-label="Walks">
      <div className="mb-3 flex flex-wrap gap-2">
        <FilterGroup label="Time">
          <Chip active={time === "today"} onClick={() => setTime("today")}>Today</Chip>
          <Chip active={time === "week"} onClick={() => setTime("week")}>This week</Chip>
        </FilterGroup>
        <FilterGroup label="Distance">
          {[5, 10, 25].map((d) => (
            <Chip key={d} active={dist === d} onClick={() => setDist(d as DistFilter)}>
              {d} mi
            </Chip>
          ))}
        </FilterGroup>
      </div>

      {query.isLoading ? (
        <SectionLoading label="Loading walks…" />
      ) : query.isError ? (
        <SectionError message="We couldn't load walks." onRetry={() => query.refetch()} />
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center">
          <p className="text-sm font-medium">No walks match this view yet.</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Post a walk for your neighborhood or check a wider distance.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button asChild size="sm" className="rounded-full">
              <Link to="/walk/new">Post a walk</Link>
            </Button>
            {dist < 25 && (
              <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setDist(25)}>
                Show 25 miles
              </Button>
            )}
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((w) => (
            <li key={w.id}>
              <WalkCard walk={w} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex gap-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-[12px] transition ${
        active
          ? "bg-forest text-cream"
          : "border border-border bg-background text-foreground hover:bg-accent/40"
      }`}
    >
      {children}
    </button>
  );
}

/* ---------- Groups ---------- */

type MyGroup = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: string;
  neighborhood: string | null;
  cover_image_url: string | null;
};
type PublicGroup = Omit<MyGroup, "visibility"> & { miles: number | null };

function GroupsSegment({ coords }: { coords: Coords }) {
  const { user } = useAuth();
  const mine = useQuery({
    queryKey: ["discover", "my-groups", user?.id],
    queryFn: () => listMyGroups(),
    staleTime: 5 * 60_000,
  });
  const publics = useQuery({
    queryKey: ["discover", "public-groups", coords?.lat ?? null, coords?.lng ?? null],
    queryFn: () =>
      discoverPublicGroups({
        data: { lat: coords?.lat ?? null, lng: coords?.lng ?? null, scope: "local" },
      }),
    staleTime: 2 * 60_000,
  });

  const owned = (mine.data?.owned ?? []) as MyGroup[];
  const member = (mine.data?.member ?? []) as MyGroup[];
  const myIds = new Set<string>([...owned.map((g) => g.id), ...member.map((g) => g.id)]);
  const publicList = ((publics.data?.groups ?? []) as PublicGroup[])
    .filter((g) => !myIds.has(g.id))
    .slice(0, 12);

  return (
    <section aria-label="Groups" className="space-y-6">
      <div>
        <SectionHeading>Your groups</SectionHeading>
        {mine.isLoading ? (
          <SectionLoading label="Loading your groups…" />
        ) : mine.isError ? (
          <SectionError message="We couldn't load your groups." onRetry={() => mine.refetch()} />
        ) : owned.length + member.length === 0 ? (
          <EmptyRow>
            You have not joined a group yet.
            <a
              href="#public-groups"
              className="ml-2 underline underline-offset-2"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("public-groups")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Browse public groups
            </a>
          </EmptyRow>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {owned.map((g) => (
              <GroupCard key={g.id} group={g} to="authed" badge="You host" />
            ))}
            {member.map((g) => (
              <GroupCard key={g.id} group={g} to="authed" badge="Member" />
            ))}
          </div>
        )}
      </div>

      <div id="public-groups">
        <SectionHeading>Public groups near you</SectionHeading>
        {publics.isLoading ? (
          <SectionLoading label="Loading nearby groups…" />
        ) : publics.isError ? (
          <SectionError message="We couldn't load nearby groups." onRetry={() => publics.refetch()} />
        ) : publicList.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center">
            <p className="text-sm font-medium">No public walking groups are nearby yet.</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Start one, or check again as the club grows.
            </p>
            <div className="mt-3">
              <Button asChild size="sm" className="rounded-full">
                <Link to="/groups">Start a group</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {publicList.map((g) => (
              <GroupCard key={g.id} group={g} to="public" />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline" className="rounded-full">
          <Link to="/groups">Manage my groups</Link>
        </Button>
        <Button asChild size="sm" className="rounded-full">
          <Link to="/groups">Start a group</Link>
        </Button>
      </div>
    </section>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/60 p-4 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function GroupCard({
  group,
  to,
  badge,
}: {
  group: MyGroup | PublicGroup;
  to: "authed" | "public";
  badge?: string;
}) {
  const isPrivate = group.visibility === "private";
  const miles = "miles" in group ? group.miles : null;
  const inner = (
    <div className="flex gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft transition hover:bg-accent/30">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
        {group.cover_image_url ? (
          <img
            src={group.cover_image_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-forest/10 text-forest">
            <Users className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate font-serif text-base">{group.name}</h3>
          {isPrivate ? (
            <Lock className="h-3 w-3 text-muted-foreground" aria-label="Private" />
          ) : (
            <Globe className="h-3 w-3 text-muted-foreground" aria-label="Public" />
          )}
        </div>
        {group.description && (
          <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{group.description}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {group.neighborhood && <span>{group.neighborhood}</span>}
          {miles != null && <span>· {miles.toFixed(1)} mi</span>}
          {badge && <span>· {badge}</span>}
        </div>
      </div>
    </div>
  );
  return to === "authed" ? (
    <Link to="/groups/$slug" params={{ slug: group.slug }} className="block">
      {inner}
    </Link>
  ) : (
    <Link to="/g/$slug" params={{ slug: group.slug }} className="block">
      {inner}
    </Link>
  );
}

/* ---------- Places ---------- */

type Trail = {
  id: string;
  name: string;
  kind: string;
  lat: number;
  lng: number;
  miles: number;
};

function PlacesSegment({
  coords,
  status,
  onRequest,
}: {
  coords: Coords;
  status: LocStatus;
  onRequest: () => void;
}) {
  const query = useQuery({
    queryKey: ["discover", "places", coords?.lat ?? null, coords?.lng ?? null],
    queryFn: () =>
      discoverTrails({ data: { lat: coords!.lat, lng: coords!.lng, limit: 20 } }),
    enabled: !!coords,
    staleTime: 10 * 60_000,
    retry: false,
  });

  if (!coords) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center">
        <MapPin className="mx-auto h-5 w-5 text-forest" />
        <p className="mt-2 text-sm font-medium">
          {status === "unsupported"
            ? "Your browser can't share location."
            : "Use your location to find nearby parks and walking paths."}
        </p>
        {status !== "unsupported" && (
          <div className="mt-3">
            <Button size="sm" className="rounded-full" onClick={onRequest}>
              Use location
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (query.isLoading) return <SectionLoading label="Loading nearby places…" />;
  if (query.isError)
    return (
      <SectionError
        message="We could not load nearby places right now."
        onRetry={() => query.refetch()}
      />
    );

  const trails = ((query.data?.trails ?? []) as Trail[]).slice(0, 12);
  if (trails.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center">
        <p className="text-sm font-medium">No named parks or paths nearby.</p>
        <p className="mt-1 text-[12px] text-muted-foreground">Try again from a different area.</p>
      </div>
    );
  }

  return (
    <section aria-label="Places">
      <SectionHeading>Parks and paths near you</SectionHeading>
      <ul className="grid gap-3 md:grid-cols-2">
        {trails.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-forest/10 text-forest">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-serif text-base">{t.name}</h3>
              <div className="mt-0.5 text-[11px] capitalize text-muted-foreground">
                {t.kind} · {t.miles.toFixed(1)} mi
              </div>
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${t.lat},${t.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-[12px] hover:bg-accent/40"
              aria-label={`Open ${t.name} in Google Maps`}
            >
              Maps <ExternalLink className="h-3 w-3" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
