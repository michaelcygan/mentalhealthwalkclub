/**
 * Small mosaic of a user's recent walk snapshots. Shows up to 6 thumbnails.
 * Tapping one navigates to the journal entry.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeading } from "@/components/section-heading";
import { Map as MapIcon } from "lucide-react";

interface Walk { id: string; route_snapshot_path: string; started_at: string; distance_meters: number | null }
interface Item extends Walk { url: string }

export function ProfileRouteMosaic({ userId }: { userId: string }) {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("walk_sessions")
        .select("id,route_snapshot_path,started_at,distance_meters")
        .eq("user_id", userId)
        .eq("status", "completed")
        .not("route_snapshot_path", "is", null)
        .order("started_at", { ascending: false })
        .limit(6);
      if (!data || cancelled) { if (!cancelled) setItems([]); return; }
      const signed = await Promise.all(
        (data as Walk[]).map(async (w) => {
          const { data: s } = await supabase.storage.from("walk-snapshots").createSignedUrl(w.route_snapshot_path, 3600);
          return s?.signedUrl ? { ...w, url: s.signedUrl } : null;
        })
      );
      if (!cancelled) setItems(signed.filter(Boolean) as Item[]);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (items === null) return null;
  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <SectionHeading eyebrow="Recent paths" title="Your route map" />
        <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
          <MapIcon className="h-4 w-4 text-forest" />
          Your finished walks will show up here as little maps.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <SectionHeading eyebrow="Recent paths" title="Your routes" />
      <div className="mt-3 grid grid-cols-3 gap-2">
        {items.map((w) => (
          <Link
            key={w.id}
            to={"/journal" as never}
            className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-secondary/40"
            aria-label={`Walk on ${new Date(w.started_at).toLocaleDateString()}`}
          >
            <img src={w.url} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/55 to-transparent p-1.5 text-[10px] font-medium uppercase tracking-wider text-primary-foreground">
              {new Date(w.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
