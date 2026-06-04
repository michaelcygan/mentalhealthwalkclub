import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, MapPin, Users, CalendarDays } from "lucide-react";
import { discoverPlaces } from "@/lib/places.functions";

export const Route = createFileRoute("/_authenticated/places")({
  component: PlacesPage,
  head: () => ({
    meta: [
      { title: "Places — Mental Health Walk Club" },
      { name: "description", content: "Parks and meetup spots where standing walks happen near you." },
    ],
  }),
});

type Place = {
  key: string;
  lat: number;
  lng: number;
  label: string | null;
  neighborhood: string | null;
  cover_image_url: string | null;
  group_count: number;
  next_summary: string | null;
  miles: number | null;
};

function PlacesPage() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [scope, setScope] = useState<"local" | "global">("local");
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { maximumAge: 60_000, timeout: 4_000 },
    );
  }, []);

  useEffect(() => {
    setLoading(true);
    discoverPlaces({ data: { lat: coords?.lat ?? null, lng: coords?.lng ?? null, scope } })
      .then((r) => setPlaces(r.places))
      .finally(() => setLoading(false));
  }, [coords, scope]);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <header className="mb-5">
        <Link to="/discover" className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Discover
        </Link>
        <div className="flex items-baseline gap-3">
          <h1 className="font-serif text-2xl text-foreground">Places</h1>
          <span className="font-hand text-xl text-rose-dust">a soft map of nearby corners</span>
        </div>
        <p className="text-xs text-muted-foreground">Parks and corners where standing walks happen.</p>
      </header>

      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {coords ? `Within 25mi · ${scope}` : `Showing ${scope}`}
        </span>
        <button
          onClick={() => setScope((s) => (s === "local" ? "global" : "local"))}
          className="text-forest underline"
        >
          {scope === "local" ? "Show all" : "Near me"}
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-card" />
          ))}
        </div>
      ) : places.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
          <p className="font-serif text-lg">No places yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Once groups schedule standing walks here, their meetup spots will show up.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {places.map((p) => (
            <li key={p.key}>
              <Link
                to="/places/$key"
                params={{ key: p.key }}
                className="block rounded-3xl border border-border bg-card p-4 shadow-soft transition hover:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-serif text-lg">{p.label ?? p.neighborhood ?? "Meetup spot"}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      {p.neighborhood && p.label && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {p.neighborhood}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {p.group_count} group{p.group_count === 1 ? "" : "s"} meet here
                      </span>
                      {p.next_summary && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {p.next_summary}
                        </span>
                      )}
                      {p.miles != null && <span>· {p.miles.toFixed(1)} mi</span>}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
