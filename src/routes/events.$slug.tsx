import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { startLocalWalk, checkInToLocalWalk, endLocalWalk, hostCheckInAttendee } from "@/server/walks.functions";
import { MapPin, Play, Square, CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/events/$slug")({ component: EventDetail });

interface EventRow {
  id: string; title: string; description: string | null; starts_at: string; ends_at: string | null;
  venue_name: string | null; address: string | null; city: string | null; state: string | null;
  location_label: string | null; lat: number | null; lng: number | null;
  meeting_point: string | null; accessibility_notes: string | null; capacity: number | null;
  attendee_count: number; donation_note: string | null; vibe: string | null; event_type: string;
  status: string; host_user_id: string | null; started_at: string | null; ended_at: string | null;
}

interface Attendee { user_id: string; status: string; checked_in_at: string | null; profiles?: { display_name: string | null } | null }

function EventDetail() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const { requireAuth } = useAuthPrompt();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [rsvp, setRsvp] = useState<{ status: string; checked_in_at: string | null } | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const startFn = useServerFn(startLocalWalk);
  const checkInFn = useServerFn(checkInToLocalWalk);
  const endFn = useServerFn(endLocalWalk);
  const hostCheckInFn = useServerFn(hostCheckInAttendee);

  const isHost = !!user && !!event && event.host_user_id === user.id;

  const refresh = async () => {
    const { data } = await supabase.from("events").select("*").eq("slug", slug).single();
    if (!data) return;
    setEvent(data as EventRow);
    if (user) {
      const { data: r } = await supabase.from("event_rsvps").select("status,checked_in_at").eq("event_id", data.id).eq("user_id", user.id).maybeSingle();
      setRsvp(r);
    }
    if (user && data.host_user_id === user.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: list } = await supabase.from("event_rsvps").select("user_id,status,checked_in_at,profiles(display_name)").eq("event_id", data.id) as any;
      setAttendees((list ?? []) as Attendee[]);
    }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug, user]);

  const goRSVP = () => requireAuth(async () => {
    if (!user || !event) return;
    if (rsvp) {
      await supabase.from("event_rsvps").delete().eq("event_id", event.id).eq("user_id", user.id);
      toast("RSVP removed");
    } else {
      await supabase.from("event_rsvps").insert({ event_id: event.id, user_id: user.id, status: "going" });
      toast.success("You're going. We'll save you a spot.");
    }
    refresh();
  });

  const startWalk = async () => {
    if (!event) return;
    setBusy("start");
    try {
      await startFn({ data: { event_id: event.id } });
      toast.success("Walk started. Folks can check in now.");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not start"); }
    finally { setBusy(null); }
  };

  const endWalk = async () => {
    if (!event) return;
    setBusy("end");
    try {
      await endFn({ data: { event_id: event.id } });
      toast.success("Walk wrapped. Thanks for hosting.");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not end"); }
    finally { setBusy(null); }
  };

  const checkInHere = () => {
    if (!event) return;
    if (!("geolocation" in navigator)) return toast.error("Your browser can't share location.");
    setBusy("checkin");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await checkInFn({ data: { event_id: event.id, lat: pos.coords.latitude, lng: pos.coords.longitude } });
          toast.success(`Checked in (${res.distance_meters}m). Glad you're here.`);
          refresh();
        } catch (e) { toast.error(e instanceof Error ? e.message : "Check-in failed"); }
        finally { setBusy(null); }
      },
      (err) => {
        setBusy(null);
        toast.error(err.code === 1 ? "Location permission denied. Ask the host to mark you present." : "Couldn't read location. Try again.");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  };

  const hostMark = async (uid: string) => {
    if (!event) return;
    setBusy(`mark-${uid}`);
    try {
      await hostCheckInFn({ data: { event_id: event.id, user_id: uid } });
      toast.success("Marked as present.");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  };

  if (!event) return <div className="py-20 text-center text-muted-foreground">…</div>;

  const startMs = new Date(event.starts_at).getTime();
  const minsToStart = (startMs - Date.now()) / 60_000;
  const canStart = isHost && event.status === "published" && Math.abs(minsToStart) <= 30;
  const inProgress = event.status === "in_progress";
  const completed = event.status === "completed";
  const locationDisplay = event.location_label || [event.city, event.state].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      <Link to={"/events" as never} className="text-sm text-muted-foreground hover:text-foreground">← All Local Walks</Link>
      <header>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-clay">Local Walk</span>
          {inProgress && <span className="rounded-full bg-forest px-2 py-0.5 text-xs font-medium text-primary-foreground">In progress</span>}
          {completed && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">Completed</span>}
          {event.status === "published" && <span className="rounded-full bg-accent px-2 py-0.5 text-xs">Scheduled</span>}
        </div>
        <h1 className="mt-1 font-serif text-3xl">{event.title}</h1>
        <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {new Date(event.starts_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          {locationDisplay && ` · ${locationDisplay}`}
        </p>
      </header>

      {event.description && <p className="text-foreground">{event.description}</p>}

      <div className="rounded-2xl border border-border bg-card p-5 text-sm">
        <Row label="Meeting point" value={event.meeting_point} />
        <Row label="Capacity" value={`${event.attendee_count}/${event.capacity ?? "—"} going`} />
        {event.vibe && <Row label="Vibe" value={event.vibe} />}
        {event.accessibility_notes && <Row label="Accessibility" value={event.accessibility_notes} />}
      </div>

      {/* Action area */}
      {!completed && (
        <div className="space-y-3">
          {!isHost && (
            <Button onClick={goRSVP} className={`h-12 w-full rounded-full ${rsvp ? "bg-secondary text-foreground" : "bg-forest text-primary-foreground"} hover:opacity-90`}>
              {rsvp ? "You're going · tap to undo" : "RSVP — I'm going"}
            </Button>
          )}

          {inProgress && rsvp && !rsvp.checked_in_at && (
            <Button onClick={checkInHere} disabled={busy === "checkin"} className="h-12 w-full rounded-full bg-forest text-primary-foreground hover:opacity-90">
              {busy === "checkin" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reading location…</> : <>Check in here (within ~50 ft)</>}
            </Button>
          )}
          {inProgress && rsvp?.checked_in_at && (
            <div className="flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-forest" /> You're checked in
            </div>
          )}

          {canStart && (
            <Button onClick={startWalk} disabled={busy === "start"} className="h-12 w-full rounded-full bg-forest text-primary-foreground hover:opacity-90">
              <Play className="mr-2 h-4 w-4" />{busy === "start" ? "Starting…" : "Start the walk"}
            </Button>
          )}
          {isHost && event.status === "published" && !canStart && (
            <p className="text-center text-xs text-muted-foreground">You can start the walk within 30 min of the scheduled time.</p>
          )}
          {isHost && inProgress && (
            <Button onClick={endWalk} disabled={busy === "end"} variant="outline" className="h-12 w-full rounded-full">
              <Square className="mr-2 h-4 w-4" />{busy === "end" ? "Wrapping…" : "End the walk"}
            </Button>
          )}
        </div>
      )}

      {/* Host attendee list */}
      {isHost && (inProgress || event.status === "published") && attendees.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-serif text-lg">Attendees ({attendees.length})</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {attendees.map((a) => (
              <li key={a.user_id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2">
                <span>{a.profiles?.display_name ?? "Walker"}</span>
                {a.checked_in_at ? (
                  <span className="flex items-center gap-1 text-xs text-forest"><CheckCircle2 className="h-3 w-3" />Present</span>
                ) : inProgress ? (
                  <button onClick={() => hostMark(a.user_id)} disabled={busy === `mark-${a.user_id}`} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-accent">
                    {busy === `mark-${a.user_id}` ? "…" : "Mark present"}
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">RSVP'd</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 last:border-0">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
