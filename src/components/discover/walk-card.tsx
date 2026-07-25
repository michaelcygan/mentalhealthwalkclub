import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { RsvpPill } from "./rsvp-pill";

export interface WalkCardData {
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
}

interface Props {
  walk: WalkCardData;
  variant?: "cover" | "list";
  onRsvp?: () => void;
  hideRsvp?: boolean;
}

export function WalkCard({ walk, variant = "list", onRsvp, hideRsvp = false }: Props) {
  const when = formatWhen(walk.starts_at);

  if (variant === "cover") {
    return (
      <Link
        to="/w/$code"
        params={{ code: walk.slug }}
        className="group relative block w-[78vw] max-w-[320px] shrink-0 snap-start overflow-hidden rounded-3xl border border-border bg-card shadow-soft"
      >
        <div className="relative h-40 overflow-hidden">
          {walk.image_url ? (
            <img
              src={walk.image_url}
              alt={walk.title}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full items-end bg-gradient-to-br from-forest/30 via-clay/20 to-cream p-4">
              <span className="font-serif text-lg text-foreground/85">{walk.city ?? "Somewhere outside"}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="font-serif text-lg leading-tight text-white">{walk.title}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/80">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {when}
              </span>
              {(walk.venue_name || walk.city) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {walk.venue_name ?? walk.city}
                </span>
              )}
              {walk.miles != null && <span>{walk.miles.toFixed(1)} mi</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3" />
            {walk.attendee_count} going
          </div>
          {!hideRsvp && <RsvpPill eventId={walk.id} onRsvp={onRsvp} />}
        </div>
      </Link>
    );
  }

  return (
    <Link
      to="/w/$code"
      params={{ code: walk.slug }}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-3 shadow-soft transition hover:bg-accent/30"
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
        {walk.image_url ? (
          <img src={walk.image_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-forest/10 text-forest">
            <MapPin className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-serif text-base">{walk.title}</h3>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {when}
          </span>
          {walk.venue_name && <span>· {walk.venue_name}</span>}
          {walk.miles != null && <span>· {walk.miles.toFixed(1)} mi</span>}
        </div>
      </div>
      {!hideRsvp && <RsvpPill eventId={walk.id} onRsvp={onRsvp} />}
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
