import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin, Users, ArrowRight } from "lucide-react";
import { RsvpPill } from "./rsvp-pill";
import type { FriendGoingEvent } from "@/lib/discover.functions";

interface Props {
  event: FriendGoingEvent;
  onRsvp?: () => void;
}

export function FriendsGoingRow({ event, onRsvp }: Props) {
  const when = formatWhen(event.starts_at);
  const names = event.going_friends.map((f) => f.display_name ?? "Someone");
  const nameText =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names[0]} and ${event.going_count - 1} others`;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft">
      <div className="flex -space-x-2">
        {event.going_friends.slice(0, 3).map((f, i) => (
          <span
            key={f.id ?? i}
            className="relative inline-block h-8 w-8 rounded-full border-2 border-background"
            style={{ zIndex: 3 - i }}
          >
            {f.avatar_url ? (
              <img src={f.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              <span className="grid h-full w-full place-items-center rounded-full bg-forest/20 text-[10px] text-forest">
                {(f.display_name ?? "?").slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          <span className="font-medium">{nameText}</span>
          <span className="text-muted-foreground"> going</span>
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {when}
          </span>
          {event.venue_name && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {event.venue_name}
            </span>
          )}
        </div>
      </div>
      <RsvpPill eventId={event.id} onRsvp={onRsvp} />
      <Link
        to="/w/$code"
        params={{ code: event.slug }}
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
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
