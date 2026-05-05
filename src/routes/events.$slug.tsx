import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/events/$slug")({ component: EventDetail });

interface Event {
  id: string; title: string; description: string | null; starts_at: string; ends_at: string | null;
  venue_name: string | null; address: string | null; city: string | null; state: string | null;
  meeting_point: string | null; accessibility_notes: string | null; capacity: number | null;
  attendee_count: number; donation_note: string | null; vibe: string | null; event_type: string;
}

function EventDetail() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [rsvp, setRsvp] = useState<{status:string; checked_in_at:string|null} | null>(null);

  const refresh = async () => {
    const { data } = await supabase.from("events").select("*").eq("slug", slug).single();
    if (!data) return;
    setEvent(data as Event);
    if (user) {
      const { data: r } = await supabase.from("event_rsvps").select("status,checked_in_at").eq("event_id", data.id).eq("user_id", user.id).maybeSingle();
      setRsvp(r);
    }
  };
  useEffect(() => { refresh(); }, [slug, user]);

  const goRSVP = async () => {
    if (!user || !event) return;
    if (rsvp) {
      await supabase.from("event_rsvps").delete().eq("event_id", event.id).eq("user_id", user.id);
      toast("RSVP removed");
    } else {
      await supabase.from("event_rsvps").insert({ event_id: event.id, user_id: user.id, status: "going" });
      toast.success("You're going. We'll save you a spot.");
    }
    refresh();
  };

  const checkIn = async () => {
    if (!user || !event) return;
    await supabase.from("event_rsvps").update({ checked_in_at: new Date().toISOString() }).eq("event_id", event.id).eq("user_id", user.id);
    toast.success("Checked in. Glad you came.");
    refresh();
  };

  if (!event) return <div className="py-20 text-center text-muted-foreground">…</div>;
  return (
    <div className="space-y-6">
      <Link to={"/events" as never} className="text-sm text-muted-foreground hover:text-foreground">← All events</Link>
      <header>
        <div className="text-xs uppercase tracking-wider text-clay">{event.event_type.replace(/_/g," ")}</div>
        <h1 className="mt-1 font-serif text-3xl">{event.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{new Date(event.starts_at).toLocaleString()} · {event.venue_name}, {event.city}, {event.state}</p>
      </header>
      <p className="text-foreground">{event.description}</p>

      <div className="rounded-2xl border border-border bg-card p-5 text-sm">
        <Row label="Meeting point" value={event.meeting_point} />
        <Row label="Address" value={event.address} />
        <Row label="Accessibility" value={event.accessibility_notes} />
        <Row label="Capacity" value={`${event.attendee_count}/${event.capacity ?? "—"} going`} />
        {event.vibe && <Row label="Vibe" value={event.vibe} />}
        {event.donation_note && <Row label="Donation" value={event.donation_note} />}
      </div>

      <div className="flex gap-3">
        <Button onClick={goRSVP} className={`h-12 flex-1 rounded-full ${rsvp ? "bg-secondary text-foreground" : "bg-forest text-primary-foreground"} hover:opacity-90`}>
          {rsvp ? "You're going · tap to undo" : "RSVP — I'm going"}
        </Button>
        {rsvp && !rsvp.checked_in_at && <Button variant="outline" onClick={checkIn} className="h-12 rounded-full">Check in</Button>}
      </div>
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
