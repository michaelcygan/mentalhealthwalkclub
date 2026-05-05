import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/journal")({
  component: JournalTab,
  head: () => ({ meta: [{ title: "Journal — Walk Club" }] }),
});

interface Walk {
  id: string; started_at: string; duration_seconds: number | null; distance_meters: number | null;
  steps: number | null; mood_before: string | null; mood_after: string | null; reflection_note: string | null;
  walk_type: string;
}
interface Badge { name: string; description: string | null; earned_at: string; }

function JournalTab() {
  const { user } = useAuth();
  const [walks, setWalks] = useState<Walk[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("walk_sessions").select("id,started_at,duration_seconds,distance_meters,steps,mood_before,mood_after,reflection_note,walk_type")
      .eq("user_id", user.id).eq("status", "completed").order("started_at", { ascending: false }).limit(50)
      .then(({ data }) => setWalks(data ?? []));
    supabase.from("user_badges").select("earned_at, badge_definitions(name,description)")
      .eq("user_id", user.id).order("earned_at", { ascending: false })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }) => setBadges((data ?? []).map((r: any) => ({ name: r.badge_definitions?.name, description: r.badge_definitions?.description, earned_at: r.earned_at }))));
  }, [user]);

  const totalMin = walks.reduce((s, w) => s + Math.round((w.duration_seconds ?? 0) / 60), 0);
  const totalMiles = walks.reduce((s, w) => s + (w.distance_meters ?? 0) * 0.000621371, 0);
  const totalSteps = walks.reduce((s, w) => s + (w.steps ?? 0), 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl">Journal</h1>
        <p className="mt-1 text-muted-foreground">Just for you. Always.</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="walks" value={walks.length} />
        <Stat label="minutes" value={totalMin} />
        <Stat label="miles" value={totalMiles.toFixed(1)} />
      </div>

      {badges.length > 0 && (
        <section>
          <h2 className="font-serif text-xl">Badges</h2>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {badges.map((b, i) => (
              <li key={i} className="rounded-2xl border border-border bg-card p-4">
                <div className="font-medium">{b.name}</div>
                <div className="text-xs text-muted-foreground">{b.description}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-serif text-xl">Walks</h2>
        {walks.length === 0 ? (
          <p className="mt-2 rounded-2xl bg-secondary p-6 text-center text-sm text-muted-foreground">Your first walk is waiting. A small walk is still a walk.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {walks.map((w) => (
              <li key={w.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">{new Date(w.started_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                  <span className="text-xs text-muted-foreground">{w.walk_type.replace(/_/g," ")}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {Math.round((w.duration_seconds ?? 0)/60)} min · {((w.distance_meters ?? 0)*0.000621371).toFixed(2)} mi · {w.steps ?? 0} steps
                </div>
                {(w.mood_before || w.mood_after) && (
                  <div className="mt-2 text-xs italic text-muted-foreground">{w.mood_before} → {w.mood_after ?? "—"}</div>
                )}
                {w.reflection_note && <p className="mt-2 text-sm">{w.reflection_note}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="pt-4 text-center font-serif text-xs italic text-muted-foreground">Total steps tracked: {totalSteps.toLocaleString()}. Still here. Still walking.</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center shadow-soft">
      <div className="font-serif text-2xl tabular-nums">{value}</div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
