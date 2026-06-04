import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { walkerLevel, type WalkerLevel } from "@/lib/walker-level";

export interface ProfileStats {
  totalWalks: number;
  totalMinutes: number;
  totalMiles: number;
  groupCount: number;
  rainyWalks: number;
  weekStreak: number;
  level: WalkerLevel;
  loading: boolean;
}

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

const empty: ProfileStats = {
  totalWalks: 0, totalMinutes: 0, totalMiles: 0, groupCount: 0, rainyWalks: 0, weekStreak: 0,
  level: walkerLevel(0), loading: true,
};

/** Single-trip stats hook used by profile + week-in-review. */
export function useProfileStats(userId: string | null | undefined): ProfileStats {
  const [s, setS] = useState<ProfileStats>(empty);

  useEffect(() => {
    if (!userId) { setS({ ...empty, loading: false }); return; }
    let cancel = false;

    supabase.from("walk_sessions")
      .select("started_at,duration_seconds,distance_meters,weather_at_end")
      .eq("user_id", userId).eq("status", "completed").limit(1000)
      .then((w) => {
      if (cancel) return;
      const rows = (w.data ?? []) as Array<{
        started_at: string; duration_seconds: number | null; distance_meters: number | null;
        weather_at_end: { code?: number } | null;
      }>;
      const totalMinutes = Math.round(rows.reduce((a, r) => a + (r.duration_seconds ?? 0), 0) / 60);
      const totalMiles = rows.reduce((a, r) => a + (r.distance_meters ?? 0), 0) / 1609.34;
      const rainyWalks = rows.filter(r => r.weather_at_end?.code != null && RAIN_CODES.has(r.weather_at_end.code)).length;

      const weeksWithWalks = new Set<string>();
      for (const r of rows) {
        const d = new Date(r.started_at);
        const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const day = t.getUTCDay() || 7;
        t.setUTCDate(t.getUTCDate() + 4 - day);
        const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((t.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        weeksWithWalks.add(`${t.getUTCFullYear()}-${weekNo}`);
      }
      let weekStreak = 0;
      const cur = new Date();
      for (let i = 0; i < 104; i++) {
        const t = new Date(Date.UTC(cur.getFullYear(), cur.getMonth(), cur.getDate() - i * 7));
        const day = t.getUTCDay() || 7;
        t.setUTCDate(t.getUTCDate() + 4 - day);
        const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((t.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        if (weeksWithWalks.has(`${t.getUTCFullYear()}-${weekNo}`)) weekStreak++;
        else if (i > 0) break;
      }

      setS({
        totalWalks: rows.length,
        totalMinutes,
        totalMiles,
        groupCount: 0,
        rainyWalks,
        weekStreak,
        level: walkerLevel(totalMinutes),
        loading: false,
      });
    });

    return () => { cancel = true; };
  }, [userId]);

  return s;
}
