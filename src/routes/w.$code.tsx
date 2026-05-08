import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarPlus, Footprints, Headphones, Mic, Share2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { joinFriendWalk } from "@/lib/friend-walk.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { share, haptics } from "@/lib/device";
import { toast } from "sonner";

export const Route = createFileRoute("/w/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `walk with me · ${params.code}` },
      { name: "description", content: "join a friend's walk & talk — live, link-only." },
      { property: "og:title", content: "come walk with me" },
      { property: "og:description", content: "live walk & talk — tap to join." },
    ],
  }),
  component: FriendWalkLanding,
});

interface RoomState {
  title: string;
  speakers: number;
  cap: number;
  status: string;
  startsAt: string | null;
  host?: { display_name: string | null; avatar_url: string | null };
}

function FriendWalkLanding() {
  const { code } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const join = useServerFn(joinFriendWalk);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("audio_rooms")
      .select("title, current_participant_count, max_participants, status, host_user_id, starts_at")
      .eq("share_code", code.toLowerCase())
      .maybeSingle()
      .then(async ({ data }) => {
        if (cancelled || !data) { setRoom(null); return; }
        let host: { display_name: string | null; avatar_url: string | null } | undefined;
        if (data.host_user_id) {
          const { data: p } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", data.host_user_id).maybeSingle();
          if (p) host = { display_name: p.display_name, avatar_url: p.avatar_url };
        }
        setRoom({
          title: data.title,
          speakers: data.current_participant_count ?? 0,
          cap: data.max_participants ?? 4,
          status: data.status,
          startsAt: data.starts_at,
          host,
        });
      });
    return () => { cancelled = true; };
  }, [code]);

  const goJoin = async (asListener: boolean) => {
    if (!user) {
      try { sessionStorage.setItem("friendWalkRedirect", `/w/${code}`); } catch { /* noop */ }
      navigate({ to: "/auth" as never });
      return;
    }
    setBusy(true);
    try {
      const r = await join({ data: { code, asListener } });
      navigate({ to: "/walk/active/$id" as never, params: { id: r.walkId } as never });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "couldn't join");
      setBusy(false);
    }
  };

  const onShare = async () => {
    haptics.tap();
    const url = typeof window !== "undefined" ? window.location.href : `/w/${code}`;
    const ok = await share({ title: room?.title ?? "walk with me", text: "come walk with me 🌿", url });
    if (!ok) try { await navigator.clipboard.writeText(url); toast("link copied"); } catch { /* noop */ }
  };

  const onAddToCalendar = () => {
    if (!room?.startsAt) return;
    haptics.tap();
    const url = typeof window !== "undefined" ? window.location.href : `https://lovable.dev/w/${code}`;
    const start = new Date(room.startsAt);
    const end = new Date(start.getTime() + 45 * 60_000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//walk//friend-walk//EN",
      "BEGIN:VEVENT",
      `UID:${code}@walk`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${(room.title || "Friend Walk").replace(/[\n,;]/g, " ")}`,
      `DESCRIPTION:Join the walk: ${url}`,
      `URL:${url}`,
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `friend-walk-${code}.ics`;
    a.click();
  };

  const isScheduled = room?.status === "scheduled" && room.startsAt;
  const startMs = room?.startsAt ? new Date(room.startsAt).getTime() : 0;
  const isHost = !!user && room?.host?.display_name !== undefined && false; // host detection done server-side; UI just shows "open early" if scheduled & past time
  const canHostOpen = isScheduled && now >= startMs - 5 * 60_000;
  const countdown = useMemo(() => {
    if (!isScheduled) return null;
    const diff = startMs - now;
    if (diff <= 0) return "starting now";
    const s = Math.floor(diff / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s % 60}s`;
  }, [isScheduled, startMs, now]);
  const whenLabel = isScheduled
    ? new Date(startMs).toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  if (loading) return <div className="py-24 text-center font-serif text-muted-foreground">a quiet moment…</div>;

  const ended = room && room.status === "closed";

  return (
    <div className="mx-auto -mx-4 min-h-[80vh] gradient-forest px-5 py-12 text-primary-foreground md:mx-0 md:rounded-3xl">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-6 grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-cream/20 ring-4 ring-cream/30">
          {room?.host?.avatar_url ? (
            <img src={room.host.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-serif text-5xl text-cream">{(room?.host?.display_name ?? "•")[0]?.toUpperCase()}</span>
          )}
        </div>

        <p className="text-[10px] uppercase tracking-[0.32em] opacity-80">
          {isScheduled ? "scheduled walk · link only" : "live walk · link only"}
        </p>
        <h1 className="mt-2 font-serif text-3xl italic leading-tight">
          {room?.host?.display_name
            ? (isScheduled ? `${room.host.display_name} is walking` : `${room.host.display_name} is walking now`)
            : room?.title || "a friend's walk"}
        </h1>

        {whenLabel && (
          <div className="mt-4 inline-flex flex-col items-center gap-1 rounded-2xl bg-cream/10 px-5 py-3 ring-1 ring-cream/20">
            <p className="text-xs uppercase tracking-widest opacity-80">{countdown}</p>
            <p className="font-serif text-base italic">{whenLabel}</p>
          </div>
        )}

        <p className="mt-4 text-sm opacity-85">
          {isScheduled
            ? "save the time — pop in when it's about to begin."
            : "come walk with them — talk, listen, or just be near."}
        </p>

        {!room && <p className="mt-10 text-sm opacity-80">finding the walk…</p>}

        {ended && (
          <div className="mt-10 space-y-4">
            <p className="font-serif text-lg italic">this walk has wrapped.</p>
            <Link to="/" className="inline-block rounded-full bg-cream px-5 py-2.5 text-xs font-medium text-forest">start your own</Link>
          </div>
        )}

        {room && !ended && isScheduled && (
          <div className="mt-8 space-y-3">
            <Button onClick={onAddToCalendar} className="h-14 w-full rounded-2xl bg-cream text-forest hover:bg-cream/90">
              <CalendarPlus className="mr-2 h-4 w-4" /> Add to calendar
            </Button>
            <Button onClick={onShare} variant="outline" className="h-12 w-full rounded-2xl border-cream/40 bg-transparent text-cream hover:bg-cream/10">
              <Share2 className="mr-2 h-4 w-4" /> Share with a friend
            </Button>
            <Button
              onClick={() => goJoin(false)}
              disabled={busy || !canHostOpen}
              variant="outline"
              className="h-12 w-full rounded-2xl border-cream/40 bg-transparent text-cream hover:bg-cream/10 disabled:opacity-50"
            >
              {canHostOpen ? "Open the walk now (host)" : "Doors open 5 min before start"}
            </Button>
          </div>
        )}

        {room && !ended && !isScheduled && (
          <div className="mt-10 space-y-3">
            <Button
              onClick={() => goJoin(false)}
              disabled={busy}
              className="h-14 w-full rounded-2xl bg-cream text-forest hover:bg-cream/90"
            >
              <Mic className="mr-2 h-4 w-4" />
              {room.speakers >= room.cap ? "Speakers full — join as listener" : "Join the walk · talk"}
            </Button>
            <Button
              onClick={() => goJoin(true)}
              disabled={busy}
              variant="outline"
              className="h-14 w-full rounded-2xl border-cream/40 bg-transparent text-cream hover:bg-cream/10"
            >
              <Headphones className="mr-2 h-4 w-4" /> Just listen
            </Button>
            <p className="pt-2 text-[11px] opacity-70">
              <Footprints className="mr-1 inline h-3 w-3" />
              {room.speakers} on the walk · {room.cap} mics
            </p>
          </div>
        )}
        {/* prevent unused-var warning */}
        <span className="hidden">{String(isHost)}</span>
      </div>
    </div>
  );
}
