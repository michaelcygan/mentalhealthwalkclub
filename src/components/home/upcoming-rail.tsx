import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, MapPin, Users } from "lucide-react";
import {
  getHomeUpcoming,
  type HomeUpcomingMine,
  type FriendGoingEvent,
} from "@/lib/discover.functions";
import { FriendsGoingRow } from "@/components/discover/friends-going-row";

export function UpcomingRail() {
  const fetchUpcoming = useServerFn(getHomeUpcoming);
  const [data, setData] = useState<{ mine: HomeUpcomingMine[]; friends: FriendGoingEvent[] } | null>(null);

  const load = useCallback(() => {
    fetchUpcoming()
      .then(setData)
      .catch(() => setData({ mine: [], friends: [] }));
  }, [fetchUpcoming]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return null;
  const { mine, friends } = data;
  if (mine.length === 0 && friends.length === 0) return null;

  const invalidate = () => load();


  return (
    <section className="space-y-3">
      <header className="px-1">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-forest" />
          <h2 className="font-serif text-lg">Upcoming</h2>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {mine.length > 0 && friends.length > 0
            ? "Walks you're on + friends going this week"
            : mine.length > 0
              ? "Walks you're on"
              : "Friends going this week"}
        </p>
      </header>

      {mine.length > 0 && (
        <ul className="space-y-2">
          {mine.map((e) => (
            <li key={e.id}>
              <MineCard event={e} />
            </li>
          ))}
        </ul>
      )}

      {friends.length > 0 && (
        <ul className="space-y-2">
          {friends.map((e) => (
            <li key={e.id}>
              <FriendsGoingRow event={e} onRsvp={invalidate} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MineCard({ event }: { event: HomeUpcomingMine }) {
  return (
    <Link
      to="/w/$code"
      params={{ code: event.slug }}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft transition hover:bg-accent/30"
    >
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
        {event.image_url ? (
          <img src={event.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-forest/10 text-forest">
            <CalendarDays className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-sm">{event.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {formatWhen(event.starts_at)}
          </span>
          {event.venue_name && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {event.venue_name}
            </span>
          )}
          {event.attendee_count > 1 && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {event.attendee_count} going
            </span>
          )}
        </div>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${
          event.role === "host"
            ? "bg-forest text-primary-foreground"
            : "bg-forest/15 text-forest"
        }`}
      >
        {event.role === "host" ? "Hosting" : "You're in"}
      </span>
    </Link>
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
