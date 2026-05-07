import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Headphones, Calendar, Radio, MapPin } from "lucide-react";

type Card =
  | { kind: "live-room"; id: string; title: string; theme: string | null; walkers: number; ts: number }
  | { kind: "scheduled-audio"; id: string; slug: string; title: string; startsAt: string; theme: string | null; ts: number }
  | { kind: "scheduled-irl"; id: string; slug: string; title: string; startsAt: string; city: string | null; ts: number };

function describeWhen(ts: number, now: number) {
  const diffMin = Math.round((ts - now) / 60_000);
  if (diffMin <= 0) return { label: "Live", live: true };
  if (diffMin < 60) return { label: `in ${diffMin} min`, live: false };
  const d = new Date(ts);
  const sameDay = new Date(now).toDateString() === d.toDateString();
  if (sameDay) return { label: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }), live: false };
  return { label: d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }), live: false };
}

export function LiveNowStrip() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const load = async () => {
      const nowDate = new Date();
      const in12h = new Date(nowDate.getTime() + 12 * 3600_000);

      const [liveRooms, scheduledEvents] = await Promise.all([
        supabase
          .from("audio_rooms")
          .select("id,title,theme,current_participant_count,scheduled_event_id,parent_room_id")
          .eq("status", "open")
          .gt("current_participant_count", 0)
          .is("parent_room_id", null) // umbrella + spontaneous only, not pods
          .limit(6),
        supabase
          .from("events")
          .select("id,title,slug,starts_at,city,event_type,vibe")
          .in("event_type", ["audio_walk", "community_walk"])
          .eq("status", "published")
          .gte("starts_at", nowDate.toISOString())
          .lte("starts_at", in12h.toISOString())
          .order("starts_at")
          .limit(8),
      ]);

      const out: Card[] = [];
      const liveRoomEventIds = new Set<string>();

      for (const r of liveRooms.data ?? []) {
        if (r.scheduled_event_id) liveRoomEventIds.add(r.scheduled_event_id);
        out.push({
          kind: "live-room",
          id: r.id,
          title: r.title,
          theme: r.theme,
          walkers: r.current_participant_count,
          ts: 0,
        });
      }

      for (const e of scheduledEvents.data ?? []) {
        // Skip scheduled audio walks already represented as live rooms
        if (e.event_type === "audio_walk" && liveRoomEventIds.has(e.id)) continue;
        const ts = new Date(e.starts_at).getTime();
        if (e.event_type === "audio_walk") {
          out.push({ kind: "scheduled-audio", id: e.id, slug: e.slug, title: e.title, startsAt: e.starts_at, theme: e.vibe, ts });
        } else {
          out.push({ kind: "scheduled-irl", id: e.id, slug: e.slug, title: e.title, startsAt: e.starts_at, city: e.city, ts });
        }
      }

      // Sort: live first (ts=0), then by absolute time
      out.sort((a, b) => a.ts - b.ts);
      setCards(out.slice(0, 6));
      setLoading(false);
    };
    load();
    const ch = supabase.channel("live-now-strip")
      .on("postgres_changes", { event: "*", schema: "public", table: "audio_rooms" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (loading) return <div className="h-24 animate-pulse rounded-2xl bg-secondary/60" />;
  if (cards.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Radio className="h-3.5 w-3.5 text-forest" />
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">Now & next</span>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {cards.map((c) => {
          if (c.kind === "live-room") {
            return (
              <div key={`r-${c.id}`} className="min-w-[220px] shrink-0 rounded-2xl border border-forest/30 bg-accent/40 p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-forest">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest/60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-forest" />
                  </span>
                  Live · {c.walkers}
                </div>
                <div className="mt-1 line-clamp-1 font-serif text-base">{c.title}</div>
                <div className="text-xs text-muted-foreground">{c.theme ?? "open"}</div>
                <p className="mt-2 text-[11px] text-muted-foreground">Start a walk to join.</p>
              </div>
            );
          }
          const when = describeWhen(c.ts, now);
          if (c.kind === "scheduled-audio") {
            return (
              <Link
                key={`a-${c.id}`}
                to={"/events/$slug" as never}
                params={{ slug: c.slug } as never}
                className="min-w-[220px] shrink-0 rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-px hover:border-forest/40"
              >
                <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-forest/80">
                  <Headphones className="h-3 w-3" /> Audio · {when.label}
                </div>
                <div className="mt-1 line-clamp-1 font-serif text-base">{c.title}</div>
                <div className="text-xs text-muted-foreground">{c.theme ?? "circle"}</div>
              </Link>
            );
          }
          return (
            <Link
              key={`i-${c.id}`}
              to={"/events/$slug" as never}
              params={{ slug: c.slug } as never}
              className="min-w-[220px] shrink-0 rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-px hover:border-forest/40"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-clay">
                <Calendar className="h-3 w-3" /> {when.label}
              </div>
              <div className="mt-1 line-clamp-1 font-serif text-base">{c.title}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />{c.city ?? "nearby"}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
