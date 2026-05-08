/**
 * "Recent group routes" — a mosaic of completed, public, opted-in walks
 * from this group's members, with map snapshots. Read-gated by RLS so we
 * only ever fetch what's allowed.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Map as MapIcon } from "lucide-react";

interface Row {
  id: string;
  user_id: string;
  started_at: string;
  duration_seconds: number | null;
  distance_meters: number | null;
  route_snapshot_path: string;
}
interface Item extends Row { url: string; displayName: string | null }

export function GroupRoutesMosaic({ groupId }: { groupId: string }) {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: walks } = await supabase
        .from("walk_sessions")
        .select("id,user_id,started_at,duration_seconds,distance_meters,route_snapshot_path")
        .eq("group_id", groupId)
        .eq("status", "completed")
        .eq("privacy", "public")
        .eq("share_map", true)
        .not("route_snapshot_path", "is", null)
        .order("started_at", { ascending: false })
        .limit(9);
      if (!walks || cancelled) { if (!cancelled) setItems([]); return; }
      const userIds = Array.from(new Set(walks.map((w) => w.user_id)));
      const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", userIds);
      const nameMap = new Map((profs ?? []).map((p) => [p.id, p.display_name as string | null]));
      const signed = await Promise.all(
        (walks as Row[]).map(async (w) => {
          const { data: s } = await supabase.storage.from("walk-snapshots").createSignedUrl(w.route_snapshot_path, 3600);
          return s?.signedUrl ? { ...w, url: s.signedUrl, displayName: nameMap.get(w.user_id) ?? null } : null;
        })
      );
      if (!cancelled) setItems(signed.filter(Boolean) as Item[]);
    })();
    return () => { cancelled = true; };
  }, [groupId]);

  if (items === null || items.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">
        <MapIcon className="h-3 w-3" /> Recent paths from this group
      </div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((w) => {
          const mins = Math.round((w.duration_seconds ?? 0) / 60);
          return (
            <div key={w.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-secondary/40 shadow-soft">
              <img src={w.url} alt={`${w.displayName ?? "A walker"}'s route`} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/65 via-foreground/20 to-transparent p-2 text-primary-foreground">
                <div className="truncate text-[10px] font-medium uppercase tracking-wider opacity-90">{w.displayName ?? "Walker"}</div>
                <div className="font-serif text-sm tabular-nums leading-tight">{mins} min</div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="px-1 text-[11px] text-muted-foreground">Only walks members chose to share publicly. Endpoints are trimmed for privacy.</p>
    </section>
  );
}
