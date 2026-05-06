import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Headphones, Calendar, Radio } from "lucide-react";

interface LiveRoom { id: string; title: string; theme: string | null; current_participant_count: number; }
interface SoonEvent { id: string; title: string; slug: string; starts_at: string; city: string | null; }

export function LiveNowStrip() {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [events, setEvents] = useState<SoonEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const in2h = new Date(now.getTime() + 2 * 3600_000);
    Promise.all([
      supabase.from("audio_rooms").select("id,title,theme,current_participant_count").eq("status", "open").gt("current_participant_count", 0).limit(4),
      supabase.from("events").select("id,title,slug,starts_at,city").gte("starts_at", now.toISOString()).lte("starts_at", in2h.toISOString()).order("starts_at").limit(4),
    ]).then(([r, e]) => {
      setRooms(r.data ?? []);
      setEvents(e.data ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="h-24 animate-pulse rounded-2xl bg-secondary/60" />;
  if (rooms.length === 0 && events.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Radio className="h-3.5 w-3.5 text-forest" />
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">Happening now</span>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {rooms.map((r) => (
          <div key={r.id} className="min-w-[220px] shrink-0 rounded-2xl border border-forest/30 bg-accent/40 p-4">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-forest">
              <Headphones className="h-3 w-3" /> Walk & Talk · live
            </div>
            <div className="mt-1 line-clamp-1 font-serif text-base">{r.title}</div>
            <div className="text-xs text-muted-foreground">{r.current_participant_count} walking · {r.theme ?? "open"}</div>
            <p className="mt-2 text-[11px] text-muted-foreground">Start a walk to join.</p>
          </div>
        ))}
        {events.map((e) => (
          <Link key={e.id} to={"/events/$slug" as never} params={{ slug: e.slug } as never} className="min-w-[220px] shrink-0 rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-px hover:border-forest/40">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-clay">
              <Calendar className="h-3 w-3" /> Local Walk · soon
            </div>
            <div className="mt-1 line-clamp-1 font-serif text-base">{e.title}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(e.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              {e.city ? ` · ${e.city}` : ""}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
