import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export interface Group {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  member_count: number;
  theme: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  location_label: string | null;
  cover_set: string | null;
}

export interface GroupPulse {
  live: number;
  walkersWeek: number;
  nextStart: string | null;
  /** UI-only flag — set by surfaces (e.g. PulseRail) to invite walkers in. Not persisted. */
  needsCompany?: boolean;
}

export interface GroupsFeed {
  groups: Group[];
  mine: Set<string>;
  pulse: Map<string, GroupPulse>;
  myCity: string | null;
  myThemes: string[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const empty: GroupPulse = { live: 0, walkersWeek: 0, nextStart: null };

// Module-level cache: keeps the Groups tab snappy when users tab away & back.
// Keyed by user id so logged-out and signed-in see the right `mine` set.
// Stale-while-revalidate: serves cached data immediately, refetches in the
// background if older than STALE_MS.
const STALE_MS = 60_000;
type Cached = {
  ts: number;
  groups: Group[];
  mine: Set<string>;
  pulse: Map<string, GroupPulse>;
  myCity: string | null;
  myThemes: string[];
};
const feedCache = new Map<string, Cached>();
let inflight: Promise<void> | null = null;

export function useGroupsFeed(): GroupsFeed {
  const { user } = useAuth();
  const cacheKey = user?.id ?? "anon";
  const seed = feedCache.get(cacheKey);
  const [groups, setGroups] = useState<Group[]>(seed?.groups ?? []);
  const [mine, setMine] = useState<Set<string>>(seed?.mine ?? new Set());
  const [pulse, setPulse] = useState<Map<string, GroupPulse>>(seed?.pulse ?? new Map());
  const [myCity, setMyCity] = useState<string | null>(seed?.myCity ?? null);
  const [myThemes, setMyThemes] = useState<string[]>(seed?.myThemes ?? []);
  const [loading, setLoading] = useState(!seed);

  const refresh = useCallback(async () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const in7dIso = new Date(now.getTime() + 7 * 86400_000).toISOString();
    const weekAgoIso = new Date(now.getTime() - 7 * 86400_000).toISOString();

    if (inflight) { await inflight; }
    const run = (async () => {
      const [g, m, rooms, evts, walks, prof, prefs] = await Promise.all([
        supabase.from("groups").select("id,name,slug,description,member_count,theme,city,state,country,location_label,cover_set").eq("is_active", true).order("member_count", { ascending: false }),
        user ? supabase.from("group_memberships").select("group_id").eq("user_id", user.id) : Promise.resolve({ data: [] as { group_id: string }[] }),
        supabase.from("audio_rooms").select("group_id").eq("status", "open").gt("current_participant_count", 0).is("parent_room_id", null),
        supabase.from("events").select("group_id,starts_at").eq("status", "published").gte("starts_at", nowIso).lte("starts_at", in7dIso).order("starts_at"),
        supabase.from("walk_sessions").select("group_id,user_id").eq("status", "completed").gte("started_at", weekAgoIso),
        user ? supabase.from("profiles").select("city").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
        user ? supabase.from("user_preferences").select("preferred_themes").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);

      const nextGroups = g.data ?? [];
      const nextMine = new Set((m.data ?? []).map((x) => x.group_id));
      const nextCity = (prof.data as { city?: string | null } | null)?.city ?? null;
      const nextThemes = ((prefs.data as { preferred_themes?: string[] } | null)?.preferred_themes) ?? [];

      const map = new Map<string, GroupPulse>();
      const get = (id: string) => map.get(id) ?? { ...empty };
      (rooms.data ?? []).forEach((r) => { if (!r.group_id) return; const v = get(r.group_id); v.live += 1; map.set(r.group_id, v); });
      (evts.data ?? []).forEach((e) => { if (!e.group_id) return; const v = get(e.group_id); if (!v.nextStart) v.nextStart = e.starts_at; map.set(e.group_id, v); });
      const seen = new Map<string, Set<string>>();
      (walks.data ?? []).forEach((w) => { if (!w.group_id) return; const s = seen.get(w.group_id) ?? new Set(); s.add(w.user_id); seen.set(w.group_id, s); });
      seen.forEach((s, id) => { const v = get(id); v.walkersWeek = s.size; map.set(id, v); });

      feedCache.set(cacheKey, { ts: Date.now(), groups: nextGroups, mine: nextMine, pulse: map, myCity: nextCity, myThemes: nextThemes });
      setGroups(nextGroups);
      setMine(nextMine);
      setMyCity(nextCity);
      setMyThemes(nextThemes);
      setPulse(map);
      setLoading(false);
    })();
    inflight = run.finally(() => { inflight = null; });
    await run;
  }, [user, cacheKey]);

  useEffect(() => {
    const cached = feedCache.get(cacheKey);
    if (!cached || Date.now() - cached.ts > STALE_MS) {
      refresh();
    } else {
      setLoading(false);
    }
  }, [cacheKey, refresh]);

  return { groups, mine, pulse, myCity, myThemes, loading, refresh };
}
