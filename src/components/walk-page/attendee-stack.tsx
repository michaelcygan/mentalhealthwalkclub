import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { listWalkAttendees, removeRsvp } from "@/lib/walks.functions";
import { X } from "lucide-react";
import { toast } from "sonner";

type Attendee = { id: string; display_name: string | null; avatar_url: string | null };
type Guest = { id: string; name: string };

interface Props {
  code: string;
  eventId: string;
  hostId: string | null;
  /** Notified when the attendee count changes so parent can sync RSVP UI. */
  onCountChange?: (total: number) => void;
}

export function AttendeeStack({ code, eventId, hostId, onCountChange }: Props) {
  const { user } = useAuth();
  const isHost = !!user && !!hostId && user.id === hostId;
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await listWalkAttendees({ data: { code } });
      setAttendees(r.attendees);
      setGuests(r.guestList ?? []);
      onCountChange?.(r.total);
    } catch {
      /* ignore */
    }
  }, [code, onCountChange]);

  useEffect(() => {
    refresh();
    // Per-mount nonce avoids StrictMode "add callbacks after subscribe()" crash
    const nonce =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    const ch = supabase
      .channel(`event-rsvps:${eventId}:${nonce}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_rsvps", filter: `event_id=eq.${eventId}` },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_rsvp_guests", filter: `event_id=eq.${eventId}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [eventId, refresh]);

  const total = attendees.length + guests.length;
  if (total === 0) return null;

  const visible = expanded ? attendees : attendees.slice(0, 6);
  const overflow = attendees.length - visible.length;

  const handleRemoveUser = async (uid: string) => {
    if (!isHost) return;
    if (!confirm("Remove this walker from the RSVP list?")) return;
    try {
      await removeRsvp({ data: { eventId, rsvpUserId: uid } });
      await refresh();
      toast.success("Removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove.");
    }
  };

  const handleRemoveGuest = async (gid: string) => {
    if (!isHost) return;
    if (!confirm("Remove this guest from the RSVP list?")) return;
    try {
      await removeRsvp({ data: { eventId, guestId: gid } });
      await refresh();
      toast.success("Removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove.");
    }
  };

  return (
    <section className="mt-4 rounded-3xl border border-border bg-card/60 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {total} going
        </p>
        {attendees.length > 6 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] text-forest underline"
          >
            {expanded ? "Show less" : "See all"}
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {visible.map((a) => (
          <span
            key={a.id}
            className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-1 text-xs"
          >
            {a.avatar_url ? (
              <img src={a.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" decoding="async" />
            ) : (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-forest/20 text-[10px] text-forest">
                {(a.display_name ?? "?").slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="max-w-[10ch] truncate">{a.display_name ?? "Walker"}</span>
            {isHost && (
              <button
                onClick={() => handleRemoveUser(a.id)}
                className="opacity-0 transition group-hover:opacity-100"
                aria-label="Remove RSVP"
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </button>
            )}
          </span>
        ))}
        {!expanded && overflow > 0 && (
          <span className="rounded-full border border-dashed border-border px-2 py-1 text-xs text-muted-foreground">
            +{overflow} more
          </span>
        )}
        {guests.length > 0 && !isHost && (
          <span className="rounded-full border border-dashed border-border px-2 py-1 text-xs text-muted-foreground">
            +{guests.length} guest{guests.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {isHost && guests.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Guests (host-only)
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {guests.map((g) => (
              <span
                key={g.id}
                className="group inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-background/60 px-2 py-1 text-xs"
              >
                {g.name}
                <button
                  onClick={() => handleRemoveGuest(g.id)}
                  className="opacity-0 transition group-hover:opacity-100"
                  aria-label="Remove guest"
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
