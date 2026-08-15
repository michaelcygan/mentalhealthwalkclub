import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, List, Map as MapIcon, MapPin, Users } from "lucide-react";
import { ClientOnly } from "@/components/client-only";
import { AreaSelector } from "@/components/public/area-selector";
import { publicWalkBoard, type PublicBoardWalk } from "@/lib/public-utility.functions";
import { loadSavedArea, saveArea, clearSavedArea, type PublicArea } from "@/lib/public-area";

const BoardMap = lazy(() => import("@/components/public/board-map"));

type WhenFilter = "anytime" | "today" | "weekend";

interface Props {
  initialWalks: PublicBoardWalk[];
  /** Area supplied by a portal or campaign link; overrides the saved choice. */
  forcedArea?: PublicArea | null;
  heading?: string;
  subheading?: string;
  /** Portals and campaign pages shouldn't let visitors wander off the area. */
  allowAreaChange?: boolean;
}

export function PublicWalkBoard({
  initialWalks,
  forcedArea = null,
  heading = "Walks near you",
  subheading = "Community walks anyone can join. No account needed to look.",
  allowAreaChange = true,
}: Props) {
  const [area, setArea] = useState<PublicArea | null>(forcedArea);
  const [when, setWhen] = useState<WhenFilter>("anytime");
  const [dogOnly, setDogOnly] = useState(false);
  const [kidOnly, setKidOnly] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");

  // Saved local choice only applies when nothing stronger was supplied.
  useEffect(() => {
    if (forcedArea) {
      setArea(forcedArea);
      return;
    }
    const saved = loadSavedArea();
    if (saved) setArea(saved);
  }, [forcedArea]);

  function updateArea(next: PublicArea | null) {
    setArea(next);
    if (next) saveArea(next);
    else clearSavedArea();
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      "public-board",
      area?.city ?? null,
      area?.lat ?? null,
      area?.lng ?? null,
      area?.radiusMiles ?? 25,
    ],
    staleTime: 60_000,
    queryFn: () =>
      publicWalkBoard({
        data: {
          lat: area?.lat ?? null,
          lng: area?.lng ?? null,
          city: area?.city ?? null,
          radiusMiles: area?.radiusMiles ?? 25,
          horizonHours: 720,
          limit: 24,
        },
      }),
  });

  const walks = data?.walks ?? initialWalks;

  const filtered = useMemo(() => {
    return walks.filter((w) => {
      if (dogOnly && !w.dog_friendly) return false;
      if (kidOnly && !w.kid_friendly) return false;
      if (when === "anytime") return true;
      const d = new Date(w.starts_at);
      const now = new Date();
      if (when === "today") return d.toDateString() === now.toDateString();
      const day = d.getDay();
      const withinWeek = d.getTime() - now.getTime() < 7 * 24 * 3600 * 1000;
      return withinWeek && (day === 0 || day === 6);
    });
  }, [walks, when, dogOnly, kidOnly]);

  const center = area?.lat != null && area?.lng != null ? { lat: area.lat, lng: area.lng } : null;

  return (
    <section aria-labelledby="board-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="board-heading" className="font-serif text-2xl leading-tight md:text-3xl">
            {heading}
          </h1>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">{subheading}</p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-soft">
          <ViewToggle
            active={view === "list"}
            onClick={() => setView("list")}
            icon={List}
            label="List"
          />
          <ViewToggle
            active={view === "map"}
            onClick={() => setView("map")}
            icon={MapIcon}
            label="Map"
          />
        </div>
      </div>

      {allowAreaChange && <AreaSelector area={area} onChange={updateArea} />}

      <div className="flex flex-wrap gap-2">
        <Chip active={when === "anytime"} onClick={() => setWhen("anytime")}>
          Anytime
        </Chip>
        <Chip active={when === "today"} onClick={() => setWhen("today")}>
          Today
        </Chip>
        <Chip active={when === "weekend"} onClick={() => setWhen("weekend")}>
          This weekend
        </Chip>
        <Chip active={dogOnly} onClick={() => setDogOnly((v) => !v)}>
          Dog friendly
        </Chip>
        <Chip active={kidOnly} onClick={() => setKidOnly((v) => !v)}>
          Kid friendly
        </Chip>
      </div>

      {isError ? (
        <BoardNotice
          title="Walks couldn't load just now."
          body="This part of the page had trouble. The rest still works."
          action={
            <button onClick={() => void refetch()} className="text-[12px] text-forest underline">
              Try again
            </button>
          }
        />
      ) : isLoading && walks.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-3xl bg-card" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyBoard area={area} />
      ) : view === "map" ? (
        <ClientOnly
          fallback={<div className="h-[420px] w-full animate-pulse rounded-3xl bg-muted" />}
        >
          <Suspense
            fallback={<div className="h-[420px] w-full animate-pulse rounded-3xl bg-muted" />}
          >
            <BoardMap walks={filtered} center={center} />
          </Suspense>
        </ClientOnly>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((w) => (
            <li key={w.id}>
              <BoardCard walk={w} />
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-serif text-lg">Know a good walk?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Post it and get a page you can share anywhere. You can start the draft before making an
          account.
        </p>
        <Link
          to="/walk/new"
          className="mt-3 inline-flex min-h-[44px] items-center rounded-full bg-forest px-5 text-sm font-medium text-primary-foreground hover:opacity-95"
        >
          Post a walk
        </Link>
      </div>
    </section>
  );
}

function BoardCard({ walk }: { walk: PublicBoardWalk }) {
  return (
    <Link
      to="/w/$code"
      params={{ code: walk.slug }}
      className="group block overflow-hidden rounded-3xl border border-border bg-card shadow-soft"
    >
      <div className="relative h-32 overflow-hidden">
        {walk.image_url ? (
          <img
            src={walk.image_url}
            alt={`${walk.title} in ${walk.city ?? "your area"}`}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full items-end bg-gradient-to-br from-forest/30 via-clay/20 to-cream p-4">
            <span className="font-serif text-base text-foreground/85">
              {walk.city ?? "Somewhere outside"}
            </span>
          </div>
        )}
      </div>
      <div className="space-y-1.5 p-4">
        <h3 className="font-serif text-base leading-tight">{walk.title}</h3>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {formatWhen(walk.starts_at, walk.timezone)}
          </span>
          {(walk.venue_name || walk.city) && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {walk.venue_name ?? walk.city}
            </span>
          )}
          {walk.miles != null && <span>{walk.miles.toFixed(1)} mi</span>}
        </p>
        <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Users className="h-3 w-3" />
          {walk.attendee_count} going
        </p>
      </div>
    </Link>
  );
}

function EmptyBoard({ area }: { area: PublicArea | null }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center">
      <MapPin className="mx-auto h-5 w-5 text-forest" />
      <p className="mt-2 text-sm font-medium">
        {area ? `No walks posted in ${area.label} yet.` : "No walks posted yet."}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-[12px] text-muted-foreground">
        Someone has to be first. Post a walk for this week and share the link — people show up for a
        plan.
      </p>
      <Link
        to="/walk/new"
        className="mt-3 inline-flex min-h-[44px] items-center rounded-full bg-forest px-5 text-sm font-medium text-primary-foreground hover:opacity-95"
      >
        Post the first walk
      </Link>
    </div>
  );
}

function BoardNotice({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-[12px] text-muted-foreground">{body}</p>
      {action && <div className="mt-2">{action}</div>}
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
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[36px] rounded-full border px-3 text-[12px] transition ${
        active
          ? "border-forest bg-forest text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ViewToggle({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof List;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-[34px] items-center gap-1 rounded-full px-3 text-[12px] ${
        active ? "bg-forest text-primary-foreground" : "text-muted-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function formatWhen(iso: string, tz: string | null) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz ?? undefined,
    });
  } catch {
    return new Date(iso).toLocaleString();
  }
}
