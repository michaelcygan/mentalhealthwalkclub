import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { Button } from "@/components/ui/button";
import { BookHeart, Award, Footprints, Share2 } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { EmptyState } from "@/components/empty-state";
import { Link } from "@tanstack/react-router";
import { share, haptics } from "@/lib/device";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export const Route = createFileRoute("/journal")({
  component: JournalTab,
  head: () => ({ meta: [{ title: "Journal — Mental Health Walk Club" }] }),
});

interface Walk {
  id: string; started_at: string; duration_seconds: number | null; distance_meters: number | null;
  steps: number | null; mood_before: string | null; mood_after: string | null;
  mood_before_score: number | null; mood_after_score: number | null;
  reflection_note: string | null; walk_type: string; route_snapshot_path: string | null;
  privacy: string; share_map: boolean | null; intention: string | null;
}
interface Badge { name: string; description: string | null; earned_at: string; }

function JournalTab() {
  const { user } = useAuth();
  const { openAuth } = useAuthPrompt();
  const [walks, setWalks] = useState<Walk[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snapshotUrls, setSnapshotUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([
      supabase.from("walk_sessions").select("id,started_at,duration_seconds,distance_meters,steps,mood_before,mood_after,mood_before_score,mood_after_score,reflection_note,walk_type,route_snapshot_path,privacy,share_map,intention")
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

  // Bulk-sign snapshot URLs for the list thumbnails
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const need = walks.filter((w) => w.route_snapshot_path && !snapshotUrls[w.id]);
      if (need.length === 0) return;
      const entries = await Promise.all(need.map(async (w) => {
        const { data } = await supabase.storage.from("walk-snapshots").createSignedUrl(w.route_snapshot_path!, 3600);
        return [w.id, data?.signedUrl] as const;
      }));
      if (cancelled) return;
      setSnapshotUrls((prev) => {
        const next = { ...prev };
        for (const [id, url] of entries) if (url) next[id] = url;
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [walks]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalMin = walks.reduce((s, w) => s + Math.round((w.duration_seconds ?? 0) / 60), 0);
  const totalMiles = walks.reduce((s, w) => s + (w.distance_meters ?? 0) * 0.000621371, 0);

  // (heatmap below derives its own per-day grid)


  // 30-day mood arc — average mood_after_score per day, smoothed sparkline
  const moodArc = useMemo(() => {
    const days: { score: number | null }[] = Array.from({ length: 30 }, () => ({ score: null }));
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const buckets = new Map<number, number[]>();
    walks.forEach((w) => {
      if (w.mood_after_score == null) return;
      const diffDays = Math.floor((now.getTime() - new Date(w.started_at).getTime()) / 86400_000);
      if (diffDays < 0 || diffDays >= 30) return;
      const k = 29 - diffDays;
      const arr = buckets.get(k) ?? [];
      arr.push(w.mood_after_score);
      buckets.set(k, arr);
    });
    buckets.forEach((arr, k) => { days[k] = { score: arr.reduce((s, n) => s + n, 0) / arr.length }; });
    return days;
  }, [walks]);
  const moodAvg = useMemo(() => {
    const vals = moodArc.map((d) => d.score).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((s, n) => s + n, 0) / vals.length : null;
  }, [moodArc]);

  const onShareEntry = async (w: Walk) => {
    haptics.tap();
    const mins = Math.round((w.duration_seconds ?? 0) / 60);
    const miles = ((w.distance_meters ?? 0) * 0.000621371).toFixed(2);
    const date = new Date(w.started_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const moodLine = w.mood_before && w.mood_after ? `${w.mood_before} → ${w.mood_after}` : (w.mood_after ?? "");
    const lines = [
      `🌿 ${date} — ${mins} min walk · ${miles} mi`,
      moodLine && `mood: ${moodLine}`,
      w.reflection_note && `“${w.reflection_note}”`,
      "— shared from Mental Health Walk Club",
    ].filter(Boolean) as string[];
    await share({ title: "A walk worth remembering", text: lines.join("\n") });
  };

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

      {/* Hero stats card with day-of-week heatmap */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft md:p-6">
        <div className="grid gap-5 md:grid-cols-[auto,1fr] md:items-center md:gap-8">
          <div className="grid grid-cols-3 gap-6">
            <Stat label="walks" value={walks.length} />
            <Stat label="minutes" value={totalMin} />
            <Stat label="miles" value={totalMiles.toFixed(1)} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">Last 12 weeks</div>
              <div className="text-[10px] tabular-nums text-muted-foreground">M T W T F S S</div>
            </div>
            <Heatmap walks={walks} />
          </div>
        </div>
        {moodAvg !== null && (
          <div className="mt-5 border-t border-border pt-4">
            <div className="flex items-baseline justify-between">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-clay/80">Mood arc · 30 days</div>
              <div className="font-serif text-sm text-muted-foreground"><span className="text-foreground tabular-nums">{moodAvg.toFixed(1)}</span> avg after</div>
            </div>
            <MoodArc points={moodArc.map((d) => d.score)} />
          </div>
        )}
      </div>
      {walks.length > 0 && (
        <section className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Memory ribbon</div>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0" style={{ scrollPaddingLeft: "1rem" }}>
            {ribbonWeeks.map((w) => {
              const empty = w.walks.length === 0;
              return (
                <article
                  key={w.offset}
                  className={`group relative w-[78%] shrink-0 snap-start overflow-hidden rounded-3xl border p-4 transition active:scale-[0.99] sm:w-[55%] md:w-[40%] lg:w-[32%] ${
                    empty ? "border-dashed border-border bg-card/60" : "border-border bg-gradient-to-br from-card via-card to-accent/30 shadow-soft"
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>{w.label}</span>
                    <span className="tabular-nums">{w.walks.length} walk{w.walks.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="font-serif text-3xl tabular-nums">{w.mins}</span>
                    <span className="text-xs text-muted-foreground">min</span>
                  </div>
                  {/* mini bar of the 7 days */}
                  <div className="mt-3 flex h-7 items-end gap-1">
                    {Array.from({ length: 7 }).map((_, i) => {
                      const dayMins = w.walks
                        .filter((wk) => {
                          const d = new Date(wk.started_at);
                          const dow = (d.getDay() + 6) % 7; // Mon=0
                          return dow === i;
                        })
                        .reduce((s, wk) => s + Math.round((wk.duration_seconds ?? 0) / 60), 0);
                      const max = Math.max(1, ...w.walks.map((wk) => Math.round((wk.duration_seconds ?? 0) / 60)));
                      return <div key={i} className="flex-1 rounded-sm bg-forest/70" style={{ height: `${Math.max(6, (dayMins / max) * 100)}%`, opacity: dayMins === 0 ? 0.18 : 0.55 + (dayMins / max) * 0.45 }} />;
                    })}
                  </div>
                  {w.mood && (
                    <div className="mt-3 inline-flex rounded-full bg-accent/60 px-2.5 py-0.5 text-[11px] capitalize">{w.mood}</div>
                  )}
                  {w.reflect && (
                    <p className="mt-2 line-clamp-2 font-serif text-sm italic leading-snug text-foreground/80">"{w.reflect}"</p>
                  )}
                  {empty && (
                    <p className="mt-3 font-serif text-sm italic text-muted-foreground">A quiet week. Rest counts too.</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

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
                        <li key={w.id} className="relative">
                          <button onClick={() => setSelectedId(active ? null : w.id)} className={`w-full rounded-2xl border p-4 pr-12 text-left transition hover:-translate-y-px ${active ? "border-forest bg-accent/40" : "border-border bg-card hover:border-forest/30"}`}>
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
                          <button
                            onClick={(e) => { e.stopPropagation(); onShareEntry(w); }}
                            aria-label="Share walk"
                            className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-accent/60 hover:text-forest"
                          >
                            <Share2 className="h-3.5 w-3.5" />
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

      {/* Mobile detail sheet — desktop already shows the sidebar pane */}
      <Sheet open={!!selectedId} onOpenChange={(v) => { if (!v) setSelectedId(null); }}>
        <SheetContent side="bottom" className="rounded-t-3xl lg:hidden">
          <WalkDetailPane walk={walks.find((w) => w.id === selectedId)} />
        </SheetContent>
      </Sheet>
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
  const [photos, setPhotos] = useState<{ url: string; t: number }[]>([]);
  const [zoom, setZoom] = useState<number | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  useEffect(() => {
    setPhotos([]);
    setSnapshotUrl(null);
    if (!walk) return;
    let cancelled = false;
    (async () => {
      const tasks: Promise<unknown>[] = [];
      tasks.push((async () => {
        const { data } = await supabase
          .from("walk_photos")
          .select("storage_path, taken_at_seconds")
          .eq("walk_session_id", walk.id)
          .order("taken_at_seconds", { ascending: true });
        if (!data || cancelled) return;
        const signed = await Promise.all(
          data.map(async (p) => {
            const { data: s } = await supabase.storage.from("walk-photos").createSignedUrl(p.storage_path, 3600);
            return s?.signedUrl ? { url: s.signedUrl, t: p.taken_at_seconds ?? 0 } : null;
          })
        );
        if (!cancelled) setPhotos(signed.filter(Boolean) as { url: string; t: number }[]);
      })());
      if (walk.route_snapshot_path) {
        tasks.push((async () => {
          const { data } = await supabase.storage.from("walk-snapshots").createSignedUrl(walk.route_snapshot_path!, 3600);
          if (!cancelled && data?.signedUrl) setSnapshotUrl(data.signedUrl);
        })());
      }
      await Promise.all(tasks);
    })();
    return () => { cancelled = true; };
  }, [walk?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onShare = async () => {
    if (!snapshotUrl || !walk) return;
    haptics.tap();
    try {
      const res = await fetch(snapshotUrl);
      const blob = await res.blob();
      const file = new File([blob], `walk-${walk.id.slice(0,8)}.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean; share?: (d: { files?: File[]; title?: string; text?: string }) => Promise<void> };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: "My walk", text: "Walked it through 🌿" });
        return;
      }
      // Fallback: download
      const a = document.createElement("a"); a.href = snapshotUrl; a.download = file.name; a.click();
    } catch { /* user cancel */ }
  };

  if (!walk) return <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Pick a walk to see its full reflection.</div>;
  const delta = walk.mood_before_score && walk.mood_after_score ? walk.mood_after_score - walk.mood_before_score : null;
  const mins = Math.round((walk.duration_seconds ?? 0) / 60);
  const miles = ((walk.distance_meters ?? 0) * 0.000621371).toFixed(2);
  const fmtT = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{new Date(walk.started_at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
      <h3 className="mt-1 font-serif text-2xl capitalize">{walk.walk_type.replace(/_/g, " ")} walk</h3>
      {snapshotUrl && (
        <div className="relative mt-4 overflow-hidden rounded-2xl border border-border bg-secondary/40">
          <img src={snapshotUrl} alt="Route map" className="aspect-square w-full object-cover" loading="lazy" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/55 via-foreground/15 to-transparent p-3 text-primary-foreground">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="font-serif text-xl tabular-nums leading-none">{miles} mi · {mins} min</div>
                {walk.intention && <div className="mt-1 line-clamp-1 font-serif text-xs italic opacity-90">{walk.intention}</div>}
              </div>
              <button type="button" onClick={onShare} className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-cream/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-soft backdrop-blur transition active:scale-95">
                <Share2 className="h-3.5 w-3.5" /> Share
              </button>
            </div>
          </div>
        </div>
      )}
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
      {photos.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Photos · {photos.length}</div>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <button
                key={i}
                onClick={() => setZoom(i)}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-secondary"
                aria-label={`Photo at ${fmtT(p.t)}`}
              >
                <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                <span className="absolute bottom-1 left-1 rounded-full bg-background/80 px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-foreground/80">{fmtT(p.t)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {walk.reflection_note && (
        <div className="mt-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Reflection</div>
          <p className="mt-1 whitespace-pre-wrap font-serif italic leading-relaxed">{walk.reflection_note}</p>
        </div>
      )}

      {zoom !== null && photos[zoom] && (
        <div onClick={() => setZoom(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/85 p-4 backdrop-blur" role="dialog" aria-label="Photo preview">
          <img src={photos[zoom].url} alt="" className="max-h-full max-w-full rounded-2xl object-contain shadow-elevated" />
        </div>
      )}
    </div>
  );
}

function MoodArc({ points }: { points: (number | null)[] }) {
  const W = 320, H = 56, pad = 4;
  const min = 1, max = 10;
  const xs = points.map((_, i) => pad + (i * (W - pad * 2)) / (points.length - 1));
  const ys = points.map((v) => v == null ? null : H - pad - ((v - min) / (max - min)) * (H - pad * 2));
  // Build polyline through known points only
  let d = "";
  let started = false;
  ys.forEach((y, i) => {
    if (y == null) return;
    d += (started ? " L " : "M ") + xs[i].toFixed(1) + " " + y.toFixed(1);
    started = true;
  });
  const last = [...ys].reverse().find((y) => y != null);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-14 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="moodArcStroke" x1="0" x2="1">
          <stop offset="0%" stopColor="oklch(0.65 0.11 45)" stopOpacity="0.6" />
          <stop offset="100%" stopColor="oklch(0.36 0.05 155)" />
        </linearGradient>
      </defs>
      {d && <path d={d} fill="none" stroke="url(#moodArcStroke)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />}
      {points.map((v, i) => v != null ? (
        <circle key={i} cx={xs[i]} cy={ys[i] ?? 0} r={1.6} fill="oklch(0.36 0.05 155)" opacity={0.7} />
      ) : null)}
      {last != null && <circle cx={xs[xs.length - 1]} cy={last} r={3} fill="oklch(0.36 0.05 155)" />}
    </svg>
  );
}

function Heatmap({ walks }: { walks: Walk[] }) {
  const grid = useMemo(() => {
    const cells: { mins: number; date: Date }[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 12 }, () => ({ mins: 0, date: new Date() }))
    );
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    for (let col = 0; col < 12; col++) {
      const weekStart = new Date(monday); weekStart.setDate(monday.getDate() - (11 - col) * 7);
      for (let row = 0; row < 7; row++) {
        const d = new Date(weekStart); d.setDate(weekStart.getDate() + row);
        cells[row][col] = { mins: 0, date: d };
      }
    }
    walks.forEach((w) => {
      const d = new Date(w.started_at); d.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400_000);
      if (diffDays < 0 || diffDays >= 12 * 7) return;
      const dow = (d.getDay() + 6) % 7;
      const todayDow = (today.getDay() + 6) % 7;
      const weekIdxFromToday = Math.floor((diffDays + todayDow - dow) / 7);
      const col = 11 - weekIdxFromToday;
      if (col < 0 || col > 11) return;
      cells[dow][col].mins += Math.round((w.duration_seconds ?? 0) / 60);
    });
    return cells;
  }, [walks]);
  const max = Math.max(1, ...grid.flat().map((c) => c.mins));
  const todayStr = new Date().toDateString();
  return (
    <div className="grid grid-cols-12 gap-[3px]" role="img" aria-label="Walks heatmap, last 12 weeks">
      {Array.from({ length: 12 }).map((_, col) => (
        <div key={col} className="grid grid-rows-7 gap-[3px]">
          {grid.map((row, r) => {
            const c = row[col];
            const intensity = c.mins / max;
            const isToday = c.date.toDateString() === todayStr;
            const bg = c.mins === 0
              ? "color-mix(in oklab, var(--forest) 8%, transparent)"
              : `color-mix(in oklab, var(--forest) ${Math.round(20 + intensity * 75)}%, transparent)`;
            return (
              <div
                key={r}
                title={`${c.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${c.mins} min`}
                className={`aspect-square rounded-[3px] ${isToday ? "ring-1 ring-forest" : ""}`}
                style={{ background: bg }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
