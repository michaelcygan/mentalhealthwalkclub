import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { Button } from "@/components/ui/button";
import { BookHeart, Award, Footprints } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { EmptyState } from "@/components/empty-state";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/journal")({
  component: JournalTab,
  head: () => ({ meta: [{ title: "Journal — Walk Club" }] }),
});

interface Walk {
  id: string; started_at: string; duration_seconds: number | null; distance_meters: number | null;
  steps: number | null; mood_before: string | null; mood_after: string | null;
  mood_before_score: number | null; mood_after_score: number | null;
  reflection_note: string | null; walk_type: string;
}
interface Badge { name: string; description: string | null; earned_at: string; }

function JournalTab() {
  const { user } = useAuth();
  const { openAuth } = useAuthPrompt();
  const [walks, setWalks] = useState<Walk[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([
      supabase.from("walk_sessions").select("id,started_at,duration_seconds,distance_meters,steps,mood_before,mood_after,mood_before_score,mood_after_score,reflection_note,walk_type")
        .eq("user_id", user.id).eq("status", "completed").order("started_at", { ascending: false }).limit(100),
      supabase.from("user_badges").select("earned_at, badge_definitions(name,description)")
        .eq("user_id", user.id).order("earned_at", { ascending: false }),
    ]).then(([w, b]) => {
      setWalks(w.data ?? []);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setBadges((b.data ?? []).map((r: any) => ({ name: r.badge_definitions?.name, description: r.badge_definitions?.description, earned_at: r.earned_at })));
      setLoading(false);
    });
  }, [user]);

  const totalMin = walks.reduce((s, w) => s + Math.round((w.duration_seconds ?? 0) / 60), 0);
  const totalMiles = walks.reduce((s, w) => s + (w.distance_meters ?? 0) * 0.000621371, 0);

  // 12 week sparkline
  const weeklyMins = useMemo(() => {
    const weeks = Array(12).fill(0);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    walks.forEach((w) => {
      const diffDays = Math.floor((now.getTime() - new Date(w.started_at).getTime()) / 86400_000);
      const wk = Math.floor(diffDays / 7);
      if (wk >= 0 && wk < 12) weeks[11 - wk] += Math.round((w.duration_seconds ?? 0) / 60);
    });
    return weeks;
  }, [walks]);
  const maxWk = Math.max(1, ...weeklyMins);

  // Memory ribbon — group walks into 8 most-recent weeks for a horizontal "cards of a week" scroll
  const ribbonWeeks = useMemo(() => {
    const weekMap = new Map<number, Walk[]>();
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    walks.forEach((w) => {
      const days = Math.floor((monday.getTime() - new Date(w.started_at).getTime()) / 86400_000);
      const wk = Math.max(0, Math.floor(days / 7) + (days < 0 ? -1 : 0));
      const list = weekMap.get(wk) ?? [];
      list.push(w);
      weekMap.set(wk, list);
    });
    const weeks: { offset: number; walks: Walk[]; label: string; mins: number; reflect?: string; mood?: string | null }[] = [];
    for (let i = 0; i < 8; i++) {
      const ws = weekMap.get(i) ?? [];
      const start = new Date(monday); start.setDate(monday.getDate() - i * 7);
      const label = i === 0 ? "This week" : i === 1 ? "Last week" : start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const mins = ws.reduce((s, w) => s + Math.round((w.duration_seconds ?? 0) / 60), 0);
      const reflect = ws.find((w) => w.reflection_note)?.reflection_note ?? undefined;
      const mood = ws.find((w) => w.mood_after)?.mood_after ?? null;
      weeks.push({ offset: i, walks: ws, label, mins, reflect: reflect ?? undefined, mood });
    }
    return weeks;
  }, [walks]);

  const grouped = useMemo(() => {
    const map = new Map<string, Walk[]>();
    walks.forEach((w) => {
      const d = new Date(w.started_at);
      const k = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(w);
    });
    return Array.from(map.entries());
  }, [walks]);

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-5 py-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent">
          <BookHeart className="h-6 w-6 text-forest" />
        </div>
        <h1 className="font-serif text-3xl">Your journal lives here</h1>
        <p className="text-muted-foreground">Walks, moods, reflections, and gentle badges — all private to you.</p>
        <Button onClick={() => openAuth("signup")} className="rounded-full bg-forest text-primary-foreground hover:opacity-90">Create your account</Button>
      </div>
    );
  }

  if (loading) return <div className="space-y-3"><div className="h-32 animate-pulse rounded-2xl bg-secondary/60" /><div className="h-64 animate-pulse rounded-2xl bg-secondary/60" /></div>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl">Journal</h1>
        <p className="mt-1 text-muted-foreground">Just for you. Always.</p>
      </header>

      {/* Hero stats card with sparkline */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft md:p-6">
        <div className="grid gap-5 md:grid-cols-[auto,1fr] md:items-center md:gap-8">
          <div className="grid grid-cols-3 gap-6">
            <Stat label="walks" value={walks.length} />
            <Stat label="minutes" value={totalMin} />
            <Stat label="miles" value={totalMiles.toFixed(1)} />
          </div>
          <div>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">Last 12 weeks</div>
            <div className="flex h-16 items-end gap-1">
              {weeklyMins.map((m, i) => (
                <div key={i} className="flex-1 rounded-t bg-forest/80" style={{ height: `${Math.max(4, (m / maxWk) * 100)}%`, opacity: m === 0 ? 0.15 : 0.5 + (m / maxWk) * 0.5 }} title={`${m} min`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {badges.length > 0 && (
        <section className="space-y-3">
          <SectionHeading eyebrow="Earned" title="Badges" />
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {badges.map((b, i) => (
              <div key={i} className="min-w-[180px] shrink-0 rounded-2xl border border-border bg-card p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent"><Award className="h-4 w-4 text-forest" /></div>
                <div className="mt-2 font-serif text-base">{b.name}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{b.description}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <SectionHeading eyebrow="Your walks" title="History" />
        {walks.length === 0 ? (
          <EmptyState icon={Footprints} title="Your first walk is waiting" body="A small walk is still a walk. Step out for five minutes — your journal will fill itself." action={<Link to="/" className="rounded-full bg-forest px-4 py-2 text-sm text-primary-foreground hover:opacity-90">Take a walk</Link>} />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr),360px]">
            <div className="space-y-5">
              {grouped.map(([month, ws]) => (
                <div key={month}>
                  <div className="sticky top-0 z-10 -mx-1 mb-2 bg-background/90 px-1 py-1 font-serif text-sm text-muted-foreground backdrop-blur">{month}</div>
                  <ul className="space-y-2">
                    {ws.map((w) => {
                      const delta = w.mood_before_score && w.mood_after_score ? w.mood_after_score - w.mood_before_score : null;
                      const active = selectedId === w.id;
                      return (
                        <li key={w.id}>
                          <button onClick={() => setSelectedId(active ? null : w.id)} className={`w-full rounded-2xl border p-4 text-left transition hover:-translate-y-px ${active ? "border-forest bg-accent/40" : "border-border bg-card hover:border-forest/30"}`}>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{new Date(w.started_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{w.walk_type.replace(/_/g, " ")}</span>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {Math.round((w.duration_seconds ?? 0) / 60)} min · {((w.distance_meters ?? 0) * 0.000621371).toFixed(2)} mi · {w.steps ?? 0} steps
                            </div>
                            {(w.mood_before || w.mood_after) && (
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                {w.mood_before && <span className="rounded-full bg-secondary px-2 py-0.5">{w.mood_before}</span>}
                                <span className="text-muted-foreground">→</span>
                                {w.mood_after ? <span className="rounded-full bg-accent px-2 py-0.5 text-accent-foreground">{w.mood_after}</span> : <span className="text-muted-foreground">—</span>}
                                {delta !== null && (
                                  <span className={`tabular-nums ${delta > 0 ? "text-forest" : delta < 0 ? "text-clay" : "text-muted-foreground"}`}>{delta > 0 ? `+${delta}` : delta}</span>
                                )}
                              </div>
                            )}
                            {w.reflection_note && <p className="mt-2 line-clamp-2 text-sm lg:line-clamp-1">{w.reflection_note}</p>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            <aside className="hidden lg:block">
              <div className="sticky top-4">
                <WalkDetailPane walk={walks.find((w) => w.id === selectedId) ?? walks[0]} />
              </div>
            </aside>
          </div>
        )}
      </section>

      <p className="pt-4 text-center font-serif text-xs italic text-muted-foreground">Still here. Still walking.</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="font-serif text-2xl tabular-nums leading-none">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function WalkDetailPane({ walk }: { walk: Walk | undefined }) {
  if (!walk) return <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Pick a walk to see its full reflection.</div>;
  const delta = walk.mood_before_score && walk.mood_after_score ? walk.mood_after_score - walk.mood_before_score : null;
  const mins = Math.round((walk.duration_seconds ?? 0) / 60);
  const miles = ((walk.distance_meters ?? 0) * 0.000621371).toFixed(2);
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{new Date(walk.started_at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
      <h3 className="mt-1 font-serif text-2xl capitalize">{walk.walk_type.replace(/_/g, " ")} walk</h3>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div><div className="font-serif text-2xl tabular-nums">{mins}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">min</div></div>
        <div><div className="font-serif text-2xl tabular-nums">{miles}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">mi</div></div>
        <div><div className="font-serif text-2xl tabular-nums">{(walk.steps ?? 0).toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">steps</div></div>
      </div>
      {(walk.mood_before || walk.mood_after) && (
        <div className="mt-5 rounded-2xl bg-secondary/60 p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Mood</div>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <span className="rounded-full bg-card px-2 py-0.5">{walk.mood_before ?? "—"}</span>
            <span>→</span>
            <span className="rounded-full bg-accent px-2 py-0.5 text-accent-foreground">{walk.mood_after ?? "—"}</span>
            {delta !== null && (
              <span className={`ml-auto font-serif text-2xl tabular-nums ${delta > 0 ? "text-forest" : delta < 0 ? "text-clay" : "text-muted-foreground"}`}>{delta > 0 ? `+${delta}` : delta}</span>
            )}
          </div>
        </div>
      )}
      {walk.reflection_note && (
        <div className="mt-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Reflection</div>
          <p className="mt-1 font-serif italic leading-relaxed">"{walk.reflection_note}"</p>
        </div>
      )}
    </div>
  );
}
