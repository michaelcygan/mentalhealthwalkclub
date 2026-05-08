import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Headphones, Calendar, Radio, MapPin, Sparkles } from "lucide-react";
import { haptics } from "@/lib/device";

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

interface Props {
  /** When provided, live-room cards become one-tap join buttons. */
  onJoinAudio?: () => void;
  /** Empty-state CTA — if provided, shows "be the first" prompt. */
  onStartAudio?: () => void;
  /** Hide entirely instead of rendering empty-state. Default: show. */
  hideWhenEmpty?: boolean;
}

export function LiveNowStrip({ onJoinAudio, onStartAudio, hideWhenEmpty = false }: Props = {}) {
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
          .is("parent_room_id", null)
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
        out.push({ kind: "live-room", id: r.id, title: r.title, theme: r.theme, walkers: r.current_participant_count, ts: 0 });
      }
      for (const e of scheduledEvents.data ?? []) {
        if (e.event_type === "audio_walk" && liveRoomEventIds.has(e.id)) continue;
        const ts = new Date(e.starts_at).getTime();
        if (e.event_type === "audio_walk") {
          out.push({ kind: "scheduled-audio", id: e.id, slug: e.slug, title: e.title, startsAt: e.starts_at, theme: e.vibe, ts });
        } else {
          out.push({ kind: "scheduled-irl", id: e.id, slug: e.slug, title: e.title, startsAt: e.starts_at, city: e.city, ts });
        }
      }
      out.sort((a, b) => a.ts - b.ts);
      setCards(out.slice(0, 8));
      setLoading(false);
    };
    load();
    const ch = supabase.channel("live-now-strip")
      .on("postgres_changes", { event: "*", schema: "public", table: "audio_rooms" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (loading) return <div className="h-32 animate-pulse rounded-2xl bg-secondary/60" />;

  const liveCount = cards.filter(c => c.kind === "live-room").reduce((s, c) => s + (c.kind === "live-room" ? c.walkers : 0), 0);
  const soonCount = cards.filter(c => c.kind !== "live-room" && c.ts > 0 && c.ts - now < 60 * 60_000).length;

  if (cards.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <section className="space-y-3">
        <SectionHeader liveCount={0} soonCount={0} />
        <button
          type="button"
          onClick={() => { if (onStartAudio) { haptics.tap(); onStartAudio(); } }}
          disabled={!onStartAudio}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-card/40 px-4 py-4 text-left transition hover:border-forest/40 disabled:cursor-default"
        >
          <div>
            <div className="font-serif text-base">All quiet right now.</div>
            <div className="text-[11px] text-muted-foreground">Be the first to start a Walk &amp; Talk — others can join you.</div>
          </div>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/60">
            <Headphones className="h-4 w-4 text-forest" />
          </span>
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <SectionHeader liveCount={liveCount} soonCount={soonCount} />
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0 md:scroll-px-0">
        {cards.map((c) => {
          if (c.kind === "live-room") {
            return (
              <button
                key={`r-${c.id}`}
                type="button"
                onClick={() => { if (onJoinAudio) { haptics.tap(); onJoinAudio(); } }}
                disabled={!onJoinAudio}
                className="group min-w-[260px] shrink-0 snap-start overflow-hidden rounded-2xl border border-forest/30 bg-gradient-to-br from-accent/60 via-accent/40 to-card p-4 text-left shadow-soft transition active:scale-[0.98] disabled:cursor-default"
              >
                <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-forest">
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest/60" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-forest" />
                    </span>
                    Live · {c.walkers} {c.walkers === 1 ? "walker" : "walkers"}
                  </span>
                  <Headphones className="h-3 w-3" />
                </div>
                <div className="mt-2 line-clamp-1 font-serif text-lg">{c.title}</div>
                <div className="text-xs text-muted-foreground">{c.theme ?? "open circle"}</div>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-forest px-3 py-1 text-[11px] font-medium text-primary-foreground transition group-hover:opacity-90">
                  <Sparkles className="h-3 w-3" />
                  {onJoinAudio ? "Tap to join" : "Start a walk to join"}
                </div>
              </button>
            );
          }
          const when = describeWhen(c.ts, now);
          if (c.kind === "scheduled-audio") {
            return (
              <Link
                key={`a-${c.id}`}
                to={"/events/$slug" as never}
                params={{ slug: c.slug } as never}
                onClick={() => haptics.tap()}
                className="min-w-[240px] shrink-0 snap-start rounded-2xl border border-border bg-card p-4 transition active:scale-[0.98] hover:-translate-y-px hover:border-forest/40"
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
              onClick={() => haptics.tap()}
              className="min-w-[240px] shrink-0 snap-start rounded-2xl border border-border bg-card p-4 transition active:scale-[0.98] hover:-translate-y-px hover:border-forest/40"
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

function SectionHeader({ liveCount, soonCount }: { liveCount: number; soonCount: number }) {
  const parts: string[] = [];
  if (liveCount > 0) parts.push(`${liveCount} walking now`);
  if (soonCount > 0) parts.push(`${soonCount} starting soon`);
  const sub = parts.length > 0 ? parts.join(" · ") : "the trail right now";
  return (
    <div className="flex items-baseline justify-between">
      <div className="flex items-center gap-2">
        <Radio className={`h-3.5 w-3.5 ${liveCount > 0 ? "text-forest live-pulse" : "text-muted-foreground"}`} />
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">Happening now</span>
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground">{sub}</span>
    </div>
  );
}
