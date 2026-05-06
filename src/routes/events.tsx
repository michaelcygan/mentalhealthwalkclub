import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Users } from "lucide-react";
import { LocationAutosuggest, type LocationValue } from "@/components/location-autosuggest";

export const Route = createFileRoute("/events")({
  component: EventsTab,
  head: () => ({ meta: [{ title: "Events — Walk Club" }] }),
});

interface Event {
  id: string; title: string; slug: string; description: string | null;
  starts_at: string; city: string | null; vibe: string | null; venue_name: string | null;
  capacity: number | null; attendee_count: number; event_type: string;
}

function EventsTab() {
  const [events, setEvents] = useState<Event[]>([]);
  const [location, setLocation] = useState<LocationValue | null>(null);

  useEffect(() => {
    const now = new Date().toISOString();
    let q = supabase.from("events").select("id,title,slug,description,starts_at,city,vibe,venue_name,capacity,attendee_count,event_type").gte("starts_at", now).order("starts_at");
    if (location?.city) q = q.ilike("city", location.city);
    q.then(({ data }) => setEvents(data ?? []));
  }, [location]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl">Events</h1>
        <p className="mt-1 text-muted-foreground">Real walks, in real places, with real people.</p>
      </header>

      <div className="max-w-md">
        <LocationAutosuggest value={location} onChange={setLocation} placeholder="Filter by city…" />
      </div>

      <ul className="space-y-3">
        {events.map((e) => (
          <li key={e.id}>
            <Link to={"/events/$slug" as never} params={{ slug: e.slug } as never} className="block rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:border-forest/40">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-clay">{e.event_type.replace(/_/g," ")}</div>
                  <h3 className="mt-1 font-serif text-xl">{e.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.description}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{new Date(e.starts_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.venue_name}, {e.city}</span>
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{e.attendee_count}/{e.capacity ?? "—"}</span>
                {e.vibe && <span className="italic">{e.vibe}</span>}
              </div>
            </Link>
          </li>
        ))}
        {events.length === 0 && <p className="rounded-2xl bg-secondary p-6 text-center text-sm text-muted-foreground">No upcoming walks here yet. A small walk on your own still counts.</p>}
      </ul>
    </div>
  );
}
