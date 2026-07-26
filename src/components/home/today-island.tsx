import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Footprints, CalendarPlus, Flame } from "lucide-react";
import { motion } from "motion/react";
import type { User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WeatherPill } from "@/components/weather-pill";
import { useCurrentWeather, useGeolocation } from "@/hooks/use-weather";
import { useProfileStats } from "@/hooks/use-profile-stats";

interface Props {
  user: User;
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function greetingForHour(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Quiet night";
}

export function TodayIsland({ user }: Props) {
  const stats = useProfileStats(user.id);
  const { coords } = useGeolocation({ autoRequest: false, ipFallback: true });
  const { data: weather } = useCurrentWeather(coords);

  const { data: recent } = useQuery({
    queryKey: ["home", "today-island", user.id],
    enabled: !!user.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("walk_sessions")
        .select("id,started_at,status,walk_type")
        .eq("user_id", user.id)
        .gte("started_at", start.toISOString());
      const days = new Set<string>();
      let activeSoloWalk: { id: string; started_at: string } | null = null;
      for (const r of (data ?? []) as { id: string; started_at: string; status: string; walk_type: string }[]) {
        if (r.status === "completed") days.add(isoDay(new Date(r.started_at)));
        if (r.status === "active" && r.walk_type === "solo" && !activeSoloWalk) {
          activeSoloWalk = { id: r.id, started_at: r.started_at };
        }
      }
      return { walkDays: days, activeSoloWalk };
    },
  });
  const walkDays = recent?.walkDays ?? new Set<string>();
  const activeSoloWalk = recent?.activeSoloWalk ?? null;
  const activeMinutes = activeSoloWalk
    ? Math.max(0, Math.round((Date.now() - new Date(activeSoloWalk.started_at).getTime()) / 60000))
    : 0;
  

  const name = useMemo(() => {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const candidates = ["first_name", "given_name", "name", "full_name", "display_name"];
    for (const k of candidates) {
      const v = meta[k];
      if (typeof v === "string" && v.trim()) return v.trim().split(/\s+/)[0];
    }
    if (user.email) return user.email.split("@")[0].replace(/^./, (c) => c.toUpperCase());
    return "";
  }, [user]);

  const greet = greetingForHour();

  const week = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const out: { iso: string; label: string; filled: boolean; isToday: boolean }[] = [];
    const wkdays = ["S", "M", "T", "W", "T", "F", "S"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = isoDay(d);
      out.push({
        iso: key,
        label: wkdays[d.getDay()],
        filled: walkDays.has(key),
        isToday: i === 0,
      });
    }
    return out;
  }, [walkDays]);

  const contextLine = useMemo(() => {
    if (!weather) {
      if (week.some((d) => d.filled && d.isToday)) return "You walked today. Quietly proud.";
      return "A quiet start. One small loop counts.";
    }
    const t = weather.tempF;
    if (weather.tone === "rain")
      return `${weather.label}, ${t}° — rain coat or wait it out`;
    if (weather.tone === "clear" && t >= 55 && t <= 78)
      return `${weather.label}, ${t}° — a perfect window to walk`;
    if (t <= 35) return `${weather.label}, ${t}° — bundle up before you head out`;
    if (t >= 88) return `${weather.label}, ${t}° — shade and water`;
    return `${weather.label}, ${t}° outside`;
  }, [weather, week]);

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-accent/40 p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {greet}
            {name ? `, ${name}` : ""}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <h1 className="font-serif text-2xl leading-tight">{name || "Welcome back"}</h1>
            {stats.weekStreak > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-clay/30 bg-clay/10 px-2 py-0.5 text-[11px] font-medium text-clay"
                title={`${stats.weekStreak} week${stats.weekStreak === 1 ? "" : "s"} in a row`}
              >
                <Flame className="h-3 w-3" />
                {stats.weekStreak}w
              </span>
            )}
          </div>
        </div>
        {weather && (
          <WeatherPill
            tempF={weather.tempF}
            label={weather.label}
            tone={weather.tone}
            isDay={weather.isDay}
          />
        )}
      </div>

      <p className="mt-2 text-sm text-muted-foreground">{contextLine}</p>

      <div
        className="mt-3 flex items-end gap-1.5"
        aria-label="Walks this week"
      >
        {week.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              className={`h-2 w-2 rounded-full ${
                d.isToday
                  ? d.filled
                    ? "bg-forest ring-2 ring-forest/30"
                    : "bg-foreground ring-2 ring-foreground/20"
                  : d.filled
                    ? "bg-forest/70"
                    : "bg-muted"
              }`}
            />
            <span
              className={`text-[10px] ${d.isToday ? "font-semibold text-foreground" : "text-muted-foreground"}`}
            >
              {d.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <Link
          to="/walk"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-forest px-4 py-3 text-sm font-medium text-primary-foreground shadow-soft transition active:scale-[0.98] hover:opacity-95"
        >
          <Footprints className="h-4 w-4" />
          {activeSoloWalk
            ? `Resume walk · ${activeMinutes} min`
            : "Start a solo walk"}
        </Link>
        {!activeSoloWalk && (
          <p className="text-center text-[11px] text-muted-foreground">
            Private timer · counts toward your routine
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/walk/new"
            className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium shadow-soft transition active:scale-[0.98] hover:bg-accent/40"
          >
            <CalendarPlus className="h-4 w-4 text-forest" /> Post a walk
          </Link>
          <Link
            to="/groups"
            className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium shadow-soft transition active:scale-[0.98] hover:bg-accent/40"
          >
            <Footprints className="h-4 w-4 text-forest" /> Groups
          </Link>
        </div>
      </div>
    </section>
  );
}
