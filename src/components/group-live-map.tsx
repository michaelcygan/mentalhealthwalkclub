/**
 * Group "Walking now" map.
 *
 * Renders a small MapLibre map with one avatar marker per group member who
 * has a live, public, opted-in walk in progress. Subscribes to walk_live_pings
 * via realtime so markers move as walkers move. Auto-prunes pings >2min old.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MapLib, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { mapStyles } from "@/lib/map-style";
import { supabase } from "@/integrations/supabase/client";
import { Footprints } from "lucide-react";

interface Ping {
  id: string;
  walk_session_id: string;
  user_id: string;
  group_id: string | null;
  lat: number;
  lng: number;
  pinged_at: string;
}
interface Profile { id: string; display_name: string | null; avatar_url: string | null; username: string | null }

const STALE_MS = 120_000;

export default function GroupLiveMap({ groupId, onStartWalk }: { groupId: string; onStartWalk?: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapLib | null>(null);
  const markers = useRef<Map<string, Marker>>(new globalThis.Map());
  const [pings, setPings] = useState<Map<string, Ping>>(new globalThis.Map());
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new globalThis.Map());
  const [selected, setSelected] = useState<string | null>(null);

  // Init map
  useEffect(() => {
    if (!ref.current || map.current) return;
    const m = new maplibregl.Map({
      container: ref.current,
      style: mapStyles.light(),
      center: [-74.006, 40.7128],
      zoom: 11,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.current = m;
    return () => { m.remove(); map.current = null; markers.current.clear(); };
  }, []);

  // Initial fetch + realtime subscribe
  useEffect(() => {
    let cancelled = false;
    const fresh = new Date(Date.now() - STALE_MS).toISOString();
    (async () => {
      const { data } = await supabase
        .from("walk_live_pings")
        .select("id, walk_session_id, user_id, group_id, lat, lng, pinged_at")
        .eq("group_id", groupId)
        .gte("pinged_at", fresh)
        .order("pinged_at", { ascending: false });
      if (cancelled || !data) return;
      // Keep only the latest ping per user
      const latest = new globalThis.Map<string, Ping>();
      for (const p of data as Ping[]) if (!latest.has(p.user_id)) latest.set(p.user_id, p);
      setPings(latest);
    })();
    const channel = supabase
      .channel(`group-live-pings-${groupId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "walk_live_pings", filter: `group_id=eq.${groupId}` }, (payload) => {
        const p = payload.new as Ping;
        setPings((prev) => {
          const next = new globalThis.Map(prev);
          next.set(p.user_id, p);
          return next;
        });
      })
      .subscribe();
    // Prune stale every 30s
    const prune = setInterval(() => {
      const cutoff = Date.now() - STALE_MS;
      setPings((prev) => {
        const next = new globalThis.Map(prev);
        for (const [k, v] of next) if (new Date(v.pinged_at).getTime() < cutoff) next.delete(k);
        return next;
      });
    }, 30_000);
    return () => { cancelled = true; supabase.removeChannel(channel); clearInterval(prune); };
  }, [groupId]);

  // Fetch profiles for active walkers
  useEffect(() => {
    const ids = Array.from(pings.keys()).filter((id) => !profiles.has(id));
    if (!ids.length) return;
    supabase.from("profiles").select("id, display_name, avatar_url, username").in("id", ids).then(({ data }) => {
      if (!data) return;
      setProfiles((prev) => {
        const next = new globalThis.Map(prev);
        for (const p of data as Profile[]) next.set(p.id, p);
        return next;
      });
    });
  }, [pings, profiles]);

  // Sync markers
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      // Remove gone
      for (const [uid, marker] of markers.current) {
        if (!pings.has(uid)) { marker.remove(); markers.current.delete(uid); }
      }
      // Add / update
      for (const [uid, p] of pings) {
        const profile = profiles.get(uid);
        let marker = markers.current.get(uid);
        if (!marker) {
          const el = document.createElement("button");
          el.className = "group-walker-marker";
          el.type = "button";
          el.setAttribute("aria-label", profile?.display_name ?? "Walker");
          el.addEventListener("click", () => setSelected(uid));
          marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([p.lng, p.lat]).addTo(m);
          markers.current.set(uid, marker);
        } else {
          marker.setLngLat([p.lng, p.lat]);
        }
        const el = marker.getElement();
        const initial = (profile?.display_name ?? profile?.username ?? "·").trim().charAt(0).toUpperCase();
        if (profile?.avatar_url) {
          el.style.backgroundImage = `url(${profile.avatar_url})`;
          el.textContent = "";
        } else {
          el.style.backgroundImage = "";
          el.textContent = initial;
        }
      }
      // Fit bounds if new markers
      if (pings.size > 0) {
        const b = new maplibregl.LngLatBounds();
        for (const p of pings.values()) b.extend([p.lng, p.lat]);
        m.fitBounds(b, { padding: 60, maxZoom: 14, duration: 600 });
      }
    };
    if (m.isStyleLoaded()) apply(); else m.once("load", apply);
  }, [pings, profiles]);

  const sel = selected ? pings.get(selected) : null;
  const selProfile = selected ? profiles.get(selected) : null;
  const count = pings.size;
  const empty = count === 0;
  const selFresh = useMemo(() => sel ? Math.max(0, Math.round((Date.now() - new Date(sel.pinged_at).getTime()) / 1000)) : 0, [sel]);

  return (
    <section className="rounded-3xl border border-border bg-card p-3 shadow-soft">
      <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
        <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">
          <span className="relative flex h-1.5 w-1.5">
            {!empty && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest/60" />}
            <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${empty ? "bg-muted-foreground/40" : "bg-forest"}`} />
          </span>
          Walking now {!empty && <span className="text-foreground">· {count}</span>}
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">approx. location</span>
      </div>
      <div className="relative h-56 overflow-hidden rounded-2xl border border-border bg-secondary/40 sm:h-64">
        <div ref={ref} className="absolute inset-0" />
        {empty && (
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            <div>
              <div className="font-serif text-base">No one is out walking right now.</div>
              <button type="button" onClick={onStartWalk} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-xs font-medium text-primary-foreground shadow-soft transition active:scale-95">
                <Footprints className="h-3.5 w-3.5" /> Be the first
              </button>
            </div>
          </div>
        )}
      </div>
      {sel && selProfile && (
        <div className="mt-2 flex items-center gap-3 rounded-2xl border border-border bg-background/60 p-3">
          <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-secondary text-sm font-medium text-foreground/70" style={selProfile.avatar_url ? { backgroundImage: `url(${selProfile.avatar_url})`, backgroundSize: "cover" } : undefined}>
            {!selProfile.avatar_url && (selProfile.display_name?.[0] ?? "·")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{selProfile.display_name ?? selProfile.username ?? "Walker"}</div>
            <div className="text-[11px] text-muted-foreground">last seen {selFresh < 60 ? `${selFresh}s` : `${Math.round(selFresh / 60)}m`} ago</div>
          </div>
          <button onClick={() => setSelected(null)} className="rounded-full px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground">close</button>
        </div>
      )}
    </section>
  );
}
