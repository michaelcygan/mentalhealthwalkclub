import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { startLocalWalk, checkInToLocalWalk, endLocalWalk, hostCheckInAttendee, rsvpToEvent } from "@/server/walks.functions";
import { joinScheduledWalk, openScheduledRoom, reshufflePods, endScheduledWalk } from "@/server/audio.functions";
import { MapPin, Play, Square, CheckCircle2, Loader2, Headphones, Shuffle, Users, Share2 } from "lucide-react";
import { share, haptics } from "@/lib/device";
import { lazy, Suspense } from "react";
const StaticLocationMap = lazy(() => import("@/components/static-location-map"));

export const Route = createFileRoute("/events/$slug")({
  component: EventDetail,
  head: ({ params }) => ({
    meta: [
      { title: `Walk together — ${params.slug.replace(/-/g, " ")} · Mental Health Walk Club` },
      { name: "description", content: "Join this Mental Health Walk Club gathering — a gentle walk, in-person or by audio. Real people, real sidewalks." },
      { property: "og:title", content: "You're invited to a walk." },
      { property: "og:description", content: "A small, peer-supported walk on Mental Health Walk Club. Tap to RSVP." },
      { property: "og:type", content: "event" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

interface EventRow {
  id: string; title: string; description: string | null; starts_at: string; ends_at: string | null;
  venue_name: string | null; address: string | null; city: string | null; state: string | null;
  location_label: string | null; lat: number | null; lng: number | null;
  meeting_point: string | null; accessibility_notes: string | null; capacity: number | null;
  attendee_count: number; donation_note: string | null; vibe: string | null; event_type: string;
  status: string; host_user_id: string | null; started_at: string | null; ended_at: string | null;
  audio_room_id: string | null; breakout_size: number; breakout_rotate_minutes: number | null;
  visibility: string; group_id: string | null;
}

interface Attendee { user_id: string; status: string; checked_in_at: string | null; profiles?: { display_name: string | null } | null }

function EventDetail() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const { requireAuth } = useAuthPrompt();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [rsvp, setRsvp] = useState<{ status: string; checked_in_at: string | null } | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [livePodCount, setLivePodCount] = useState<{ pods: number; walkers: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [groupInfo, setGroupInfo] = useState<{ name: string; slug: string | null } | null>(null);
  const [isMember, setIsMember] = useState<boolean>(false);

  const startFn = useServerFn(startLocalWalk);
  const checkInFn = useServerFn(checkInToLocalWalk);
  const endFn = useServerFn(endLocalWalk);
  const hostCheckInFn = useServerFn(hostCheckInAttendee);
  const joinScheduledFn = useServerFn(joinScheduledWalk);
  const openRoomFn = useServerFn(openScheduledRoom);
  const reshuffleFn = useServerFn(reshufflePods);
  const rsvpFn = useServerFn(rsvpToEvent);
  const endAudioFn = useServerFn(endScheduledWalk);

  const isHost = !!user && !!event && event.host_user_id === user.id;
  const isAudio = event?.event_type === "audio_walk";
  const isGroupOnly = !!event && event.visibility === "group" && !!event.group_id;
  const memberGated = isGroupOnly && !!user && !isHost && !isMember;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

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
    // Live pod stats for audio walks
    if (data.event_type === "audio_walk" && data.audio_room_id) {
      const { data: pods } = await supabase
        .from("audio_rooms")
        .select("id,current_participant_count")
        .or(`id.eq.${data.audio_room_id},parent_room_id.eq.${data.audio_room_id}`);
      const list = (pods ?? []).filter((p) => data.breakout_size > 0 ? p.id !== data.audio_room_id : true);
      const walkers = list.reduce((s, p) => s + (p.current_participant_count ?? 0), 0);
      setLivePodCount({ pods: data.breakout_size > 0 ? list.length : 1, walkers });
    }
    // Group info + membership
    if (data.visibility === "group" && data.group_id) {
      const { data: g } = await supabase.from("groups").select("name,slug").eq("id", data.group_id).single();
      setGroupInfo(g ?? null);
      if (user) {
        const { data: mem } = await supabase
          .from("group_memberships")
          .select("id")
          .eq("group_id", data.group_id)
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle();
        setIsMember(!!mem);
      } else {
        setIsMember(false);
      }
    } else {
      setGroupInfo(null);
      setIsMember(true);
    }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug, user]);

  // Realtime for live audio walk stats
  useEffect(() => {
    if (!event?.audio_room_id) return;
    const ch = supabase.channel(`event-live-${event.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "audio_rooms" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.audio_room_id]);

  const joinGroup = async () => {
    if (!user || !event?.group_id) return;
    await supabase.from("group_memberships").insert({ group_id: event.group_id, user_id: user.id });
    toast.success(`Joined ${groupInfo?.name ?? "the group"}.`);
    await refresh();
  };

  const goRSVP = () => requireAuth(async () => {
    if (!user || !event) return;
    if (rsvp) {
      await supabase.from("event_rsvps").delete().eq("event_id", event.id).eq("user_id", user.id);
      toast("RSVP removed");
      refresh();
      return;
    }
    try {
      const res = await rsvpFn({ data: { event_id: event.id } });
      if (!res.ok && res.requiresJoin) {
        toast(`${res.groupName} members only — join to RSVP.`);
        return;
      }
      toast.success("You're going. We'll save you a spot.");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't RSVP"); }
  });

  const startWalk = async () => {
    if (!event) return;
    setBusy("start");
    try {
      await startFn({ data: { event_id: event.id } });
      toast.success("Walk started.");
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

  const joinCircle = () => requireAuth(async () => {
    if (!event) return;
    setBusy("join");
    try {
      const res = await joinScheduledFn({ data: { eventId: event.id } });
      if (res.requiresJoin) {
        toast(`${res.groupName} members only — join to enter.`);
        setBusy(null);
        return;
      }
      toast.success(res.podIndex ? `You're in pod ${res.podIndex}.` : "You're in the circle.");
      navigate({ to: "/walk/active/$id" as never, params: { id: res.walkSessionId } as never });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not join"); setBusy(null); }
  });

  const endAudio = async () => {
    if (!event) return;
    setBusy("end-audio");
    try {
      await endAudioFn({ data: { eventId: event.id } });
      toast.success("Walk ended. Thank you for hosting.");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not end"); }
    finally { setBusy(null); }
  };

  const openEarly = async () => {
    if (!event) return;
    setBusy("open");
    try {
      await openRoomFn({ data: { eventId: event.id } });
      toast.success("Circle opened. Walkers can join now.");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not open"); }
    finally { setBusy(null); }
  };

  const reshuffle = async () => {
    if (!event) return;
    setBusy("reshuffle");
    try {
      const r = await reshuffleFn({ data: { eventId: event.id } });
      toast.success(`Mixed ${r.rotated} walker${r.rotated === 1 ? "" : "s"}.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not reshuffle"); }
    finally { setBusy(null); }
  };

  if (!event) return <div className="py-20 text-center text-muted-foreground">…</div>;

  const startMs = new Date(event.starts_at).getTime();
  const minsToStart = (startMs - now) / 60_000;
  const canStart = isHost && event.status === "published" && Math.abs(minsToStart) <= 30 && !isAudio;
  const inProgress = event.status === "in_progress";
  const completed = event.status === "completed";
  const locationDisplay = event.location_label || [event.city, event.state].filter(Boolean).join(", ");
  const audioJoinable = isAudio && minsToStart <= 5 && !completed;
  const audioOpenedEarly = isAudio && isHost && minsToStart > 5 && event.status === "published";

  const startLabel = (() => {
    if (minsToStart > 60) return new Date(event.starts_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    if (minsToStart > 0) return `Starting in ${Math.ceil(minsToStart)} min`;
    if (minsToStart > -1) return "Starting now";
    return "Live";
  })();

  return (
    <div className="space-y-6">
      <Link to={"/events" as never} className="text-sm text-muted-foreground hover:text-foreground">← All Walks</Link>
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-xs uppercase tracking-wider text-clay">
            {isAudio ? <Headphones className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
            {isAudio ? "Audio Walk" : "Local Walk"}
          </span>
          {inProgress && <span className="rounded-full bg-forest px-2 py-0.5 text-xs font-medium text-primary-foreground">In progress</span>}
          {completed && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">Completed</span>}
          {event.status === "published" && <span className="rounded-full bg-accent px-2 py-0.5 text-xs">{startLabel}</span>}
          {isGroupOnly && groupInfo && (
            <Link to={"/groups/$slug" as never} params={{ slug: groupInfo.slug ?? "" } as never} className="rounded-full border border-forest/30 bg-card px-2 py-0.5 text-xs text-forest hover:bg-accent">
              {groupInfo.name} · members only
            </Link>
          )}
        </div>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h1 className="font-serif text-3xl tracking-tight">{event.title}</h1>
          <button
            onClick={async () => {
              haptics.tap();
              const when = new Date(event.starts_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
              const ok = await share({
                title: `${event.title} — Mental Health Walk Club`,
                text: `${isAudio ? "Walk & Talk" : "Local walk"} · ${when}${!isAudio && locationDisplay ? ` · ${locationDisplay}` : ""}`,
                url: typeof window !== "undefined" ? window.location.href : undefined,
              });
              if (ok) toast("Invite ready to share.");
            }}
            aria-label="Share event"
            className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground/80 transition hover:border-forest/40 hover:text-forest"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
          {new Date(event.starts_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          {!isAudio && locationDisplay && ` · ${locationDisplay}`}
        </p>
      </header>

      {event.description && <p className="text-foreground">{event.description}</p>}

      <div className="rounded-2xl border border-border bg-card p-5 text-sm">
        {isAudio ? (
          <>
            <Row label="Format" value={event.breakout_size === 0 ? `One open circle · ${event.capacity ?? 8} spots` : `${event.breakout_size === 2 ? "Pairs" : event.breakout_size === 3 ? "Trios" : "Quads"} of ${event.breakout_size} · facilitator seat reserved`} />
            {event.breakout_rotate_minutes && <Row label="Mixing" value={`Walkers shuffle every ${event.breakout_rotate_minutes} min`} />}
            {event.vibe && <Row label="Theme" value={event.vibe} />}
            {livePodCount && livePodCount.walkers > 0 && (
              <Row label="Live now" value={`${livePodCount.walkers} walking · ${livePodCount.pods} pod${livePodCount.pods === 1 ? "" : "s"}`} />
            )}
          </>
        ) : (
          <>
            <Row label="Meeting point" value={event.meeting_point} />
            <Row label="Capacity" value={`${event.attendee_count}/${event.capacity ?? "—"} going`} />
            {event.vibe && <Row label="Vibe" value={event.vibe} />}
            {event.accessibility_notes && <Row label="Accessibility" value={event.accessibility_notes} />}
          </>
        )}
      </div>

      {!isAudio && event.lat != null && event.lng != null && (
        <Suspense fallback={<div className="h-44 rounded-2xl border border-dashed border-border" />}>
          <StaticLocationMap lat={Number(event.lat)} lng={Number(event.lng)} className="h-44" label={`Map of ${event.venue_name ?? event.title}`} />
        </Suspense>
      )}

      {/* Action area */}
      {!completed && memberGated && (
        <div className="rounded-2xl border border-forest/20 bg-accent/40 p-5 text-center">
          <p className="font-serif text-base">
            Reserved for {groupInfo?.name ?? "the group"}.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Join the group to RSVP and walk together.
          </p>
          <Button onClick={() => requireAuth(joinGroup)} className="mt-4 h-12 w-full rounded-full bg-forest text-primary-foreground hover:opacity-90">
            Join {groupInfo?.name ?? "group"} to RSVP
          </Button>
        </div>
      )}

      {!completed && !memberGated && (
        <div className="space-y-3">
          {isAudio ? (
            <>
              {audioJoinable && (
                <Button onClick={joinCircle} disabled={busy === "join"} className="h-14 w-full rounded-full bg-forest text-primary-foreground text-base hover:opacity-90">
                  {busy === "join" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Joining…</> : <><Headphones className="mr-2 h-4 w-4" />Join the circle</>}
                </Button>
              )}
              {!audioJoinable && !isHost && (
                <Button onClick={goRSVP} className={`h-12 w-full rounded-full ${rsvp ? "bg-secondary text-foreground" : "bg-forest text-primary-foreground"} hover:opacity-90`}>
                  {rsvp ? "You'll be there · tap to undo" : "I'll be there"}
                </Button>
              )}
              {audioOpenedEarly && (
                <Button onClick={openEarly} disabled={busy === "open"} variant="outline" className="h-12 w-full rounded-full">
                  {busy === "open" ? "Opening…" : "Open circle early"}
                </Button>
              )}
              {isHost && event.breakout_size > 0 && livePodCount && livePodCount.walkers > 1 && (
                <Button onClick={reshuffle} disabled={busy === "reshuffle"} variant="outline" className="h-12 w-full rounded-full">
                  <Shuffle className="mr-2 h-4 w-4" />{busy === "reshuffle" ? "Mixing…" : "Reshuffle pods now"}
                </Button>
              )}
              {isHost && (
                <Button onClick={endAudio} disabled={busy === "end-audio"} variant="ghost" className="h-10 w-full rounded-full text-muted-foreground">
                  {busy === "end-audio" ? "Wrapping…" : "End this walk"}
                </Button>
              )}
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}

      {/* Host attendee list (IRL only) */}
      {!isAudio && isHost && (inProgress || event.status === "published") && attendees.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-serif text-lg flex items-center gap-2"><Users className="h-4 w-4" />Attendees ({attendees.length})</h2>
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
