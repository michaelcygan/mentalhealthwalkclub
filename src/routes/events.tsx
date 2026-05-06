import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MapPin, Users } from "lucide-react";
import { LocationAutosuggest, type LocationValue } from "@/components/location-autosuggest";

export const Route = createFileRoute("/events")({
  component: EventsTab,
  head: () => ({ meta: [{ title: "Local Walks — Walk Club" }] }),
});

interface Event {
  id: string; title: string; slug: string; description: string | null;
  starts_at: string; city: string | null; vibe: string | null; venue_name: string | null;
  capacity: number | null; attendee_count: number; event_type: string;
  lat: number | null; lng: number | null;
}

const vibeGradient: Record<string, string> = {
  gentle: "from-emerald-200/50 to-sky-200/40",
  social: "from-amber-200/50 to-rose-200/40",
  silent: "from-slate-200/50 to-stone-200/40",
  reset: "from-violet-200/50 to-indigo-200/40",
};

function bucketFor(starts: Date) {
  const now = new Date();
  const day = 86400_000;
  const diff = (starts.getTime() - now.getTime()) / day;
  const dow = now.getDay();
  const daysToWeekend = (6 - dow + 7) % 7;
  if (diff < daysToWeekend + 2 && diff >= 0) return "This weekend";
  if (diff < 7) return "This week";
  if (diff < 14) return "Next week";
  return "Later";
}

function haversineMi(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function EventsTab() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [didDefault, setDidDefault] = useState(false);

  useEffect(() => {
    if (!user || didDefault) return;
    supabase.from("profiles").select("city,region,country,location_label,lat,lng").eq("id", user.id).single().then(({ data }) => {
      if (data?.city) setLocation({ city: data.city, region: data.region, country: data.country, location_label: data.location_label ?? data.city, lat: data.lat, lng: data.lng });
      if (data?.lat && data?.lng) setMe({ lat: Number(data.lat), lng: Number(data.lng) });
      setDidDefault(true);
    });
  }, [user, didDefault]);

  useEffect(() => {
    const now = new Date().toISOString();
    let q = supabase.from("events").select("id,title,slug,description,starts_at,city,vibe,venue_name,capacity,attendee_count,event_type,lat,lng").gte("starts_at", now).order("starts_at");
    if (location?.city) q = q.ilike("city", location.city);
    q.then(({ data }) => setEvents(data ?? []));
  }, [location]);

  const grouped = useMemo(() => {
    const m = new Map<string, Event[]>();
    events.forEach((e) => {
      const k = bucketFor(new Date(e.starts_at));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    });
    return Array.from(m.entries());
  }, [events]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">Local Walks</h1>
          <p className="mt-1 text-muted-foreground">Real walks, in real places, with real people.</p>
        </div>
        <Link to={"/events/new" as never} className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          Schedule a walk
        </Link>
      </header>

      <div className="max-w-md">
        <LocationAutosuggest value={location} onChange={setLocation} placeholder="Filter by city…" />
      </div>

      {grouped.length === 0 && (
        <p className="rounded-2xl bg-secondary p-6 text-center text-sm text-muted-foreground">No upcoming walks here yet. A small walk on your own still counts.</p>
      )}

      <div className="space-y-6">
        {grouped.map(([bucket, list]) => (
          <section key={bucket} className="space-y-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">{bucket}</div>
            <ul className="space-y-3">
              {list.map((e) => {
                const grad = (e.vibe && vibeGradient[e.vibe]) || "from-accent/40 to-card";
                const dist = me && e.lat && e.lng ? haversineMi(me, { lat: Number(e.lat), lng: Number(e.lng) }) : null;
                return (
                  <li key={e.id}>
                    <Link to={"/events/$slug" as never} params={{ slug: e.slug } as never} className="block overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition hover:-translate-y-px hover:border-forest/40">
                      <div className={`h-2 w-full bg-gradient-to-r ${grad}`} />
                      <div className="p-5">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-clay">
                          <span>{e.event_type.replace(/_/g, " ")}</span>
                          {e.vibe && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] normal-case tracking-normal text-foreground">{e.vibe}</span>}
                        </div>
                        <h3 className="mt-1 font-serif text-xl">{e.title}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.description}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{new Date(e.starts_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.venue_name}, {e.city}</span>
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{e.attendee_count}/{e.capacity ?? "—"}</span>
                          {dist !== null && <span className="rounded-full bg-accent px-2 py-0.5 text-accent-foreground">{dist < 0.1 ? "<0.1" : dist.toFixed(1)} mi away</span>}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
