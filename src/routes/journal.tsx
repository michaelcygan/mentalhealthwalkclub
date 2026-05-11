import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { Button } from "@/components/ui/button";
import { BookHeart, Award, Footprints, Share2, ChevronDown } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { EmptyState } from "@/components/empty-state";
import { Link } from "@tanstack/react-router";
import { share, haptics } from "@/lib/device";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { bakeShareCard } from "@/lib/share-card";
import { toast } from "sonner";
import { TrackingStrip, type Period, type TrackingWalk } from "@/components/journal/tracking-strip";
import { SignalsRow } from "@/components/journal/signals-row";
import { WalkingWithYou } from "@/components/journal/walking-with-you";
import { EntrySearch, type MoodFilter } from "@/components/journal/entry-search";
import { EntryCard } from "@/components/journal/entry-card";

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
  group_id: string | null;
  weather_at_end: { tempF?: number; label?: string; tone?: string; isDay?: boolean } | null;
}
interface Badge { name: string; description: string | null; earned_at: string; }
interface PrimaryGroup { id: string; name: string }

function JournalTab() {
  const { user } = useAuth();
  const { openAuth } = useAuthPrompt();
  const [walks, setWalks] = useState<Walk[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [primaryGroup, setPrimaryGroup] = useState<PrimaryGroup | null>(null);
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [photoUrlsByWalk, setPhotoUrlsByWalk] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snapshotUrls, setSnapshotUrls] = useState<Record<string, string>>({});
  const [period, setPeriod] = useState<Period>("week");
  const [query, setQuery] = useState("");
  const [moodFilter, setMoodFilter] = useState<MoodFilter>("all");
  const [statsOpen, setStatsOpen] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([
      supabase.from("walk_sessions").select("id,started_at,duration_seconds,distance_meters,steps,mood_before,mood_after,mood_before_score,mood_after_score,reflection_note,walk_type,route_snapshot_path,privacy,share_map,intention,group_id,weather_at_end")
        .eq("user_id", user.id).eq("status", "completed").order("started_at", { ascending: false }).limit(100),
      supabase.from("user_badges").select("earned_at, badge_definitions(name,description)")
        .eq("user_id", user.id).order("earned_at", { ascending: false }),
      supabase.from("group_memberships")
        .select("group_id, joined_at, groups(id,name)")
        .eq("user_id", user.id).order("joined_at", { ascending: true }).limit(1),
    ]).then(([w, b, g]) => {
      const ws = (w.data ?? []) as unknown as Walk[];
      setWalks(ws);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setBadges((b.data ?? []).map((r: any) => ({ name: r.badge_definitions?.name, description: r.badge_definitions?.description, earned_at: r.earned_at })));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gRow: any = (g.data ?? [])[0];
      if (gRow?.groups) setPrimaryGroup({ id: gRow.groups.id, name: gRow.groups.name });
      setLoading(false);
    });
  }, [user]);

  // Bulk-sign snapshot URLs for the entry cards
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

  // Photo counts + first-3 signed URLs per walk — single grouped read, then batch sign
  useEffect(() => {
    if (!user || walks.length === 0) return;
    let cancelled = false;
    (async () => {
      const ids = walks.map((w) => w.id);
      const { data } = await supabase
        .from("walk_photos")
        .select("walk_session_id,storage_path,taken_at_seconds,created_at")
        .in("walk_session_id", ids)
        .order("taken_at_seconds", { ascending: true });
      if (cancelled || !data) return;
      const counts: Record<string, number> = {};
      const pathsByWalk: Record<string, string[]> = {};
      for (const row of data as { walk_session_id: string; storage_path: string }[]) {
        counts[row.walk_session_id] = (counts[row.walk_session_id] ?? 0) + 1;
        if (!pathsByWalk[row.walk_session_id]) pathsByWalk[row.walk_session_id] = [];
        if (pathsByWalk[row.walk_session_id].length < 3) pathsByWalk[row.walk_session_id].push(row.storage_path);
      }
      setPhotoCounts(counts);

      // Sign all needed paths in parallel
      const allPaths = Object.values(pathsByWalk).flat();
      const signed = await Promise.all(
        allPaths.map(async (p) => {
          const { data: s } = await supabase.storage.from("walk-photos").createSignedUrl(p, 3600);
          return [p, s?.signedUrl] as const;
        }),
      );
      if (cancelled) return;
      const urlByPath = new Map(signed.filter(([, u]) => !!u) as [string, string][]);
      const urlsByWalk: Record<string, string[]> = {};
      for (const [walkId, paths] of Object.entries(pathsByWalk)) {
        urlsByWalk[walkId] = paths.map((p) => urlByPath.get(p)).filter((u): u is string => !!u);
      }
      setPhotoUrlsByWalk(urlsByWalk);
    })();
    return () => { cancelled = true; };
  }, [user, walks]);

  // Streak in weeks (consecutive weeks with at least one walk, ending this week)
  const streakWeeks = useMemo(() => {
    if (walks.length === 0) return 0;
    const startOfWeek = new Date(); startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
    const weeksWithWalks = new Set<number>();
    walks.forEach((w) => {
      const days = Math.floor((startOfWeek.getTime() - new Date(w.started_at).getTime()) / 86400_000);
      const wk = Math.floor(days / 7) + (days < 0 ? -1 : 0);
      weeksWithWalks.add(Math.max(0, wk));
    });
    let s = 0;
    while (weeksWithWalks.has(s)) s++;
    return s;
  }, [walks]);

  const onShareEntry = async (w: Walk) => {
    haptics.tap();
    const mins = Math.round((w.duration_seconds ?? 0) / 60);
    const miles = ((w.distance_meters ?? 0) * 0.000621371).toFixed(2);
    const date = new Date(w.started_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const snapUrl = snapshotUrls[w.id];
    const photoUrl = photoUrlsByWalk[w.id]?.[0] ?? null;
    const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean; share?: (d: { files?: File[]; title?: string; text?: string }) => Promise<void> };

    if (snapUrl || photoUrl) {
      try {
        const blob = await bakeShareCard(snapUrl ?? null, {
          miles, minutes: mins, steps: w.steps, date,
          moodBefore: w.mood_before, moodAfter: w.mood_after, walkType: w.walk_type,
          weather: w.weather_at_end ? { tempF: w.weather_at_end.tempF, label: w.weather_at_end.label } : null,
        }, photoUrl);
        if (blob) {
          const file = new File([blob], `walk-${w.id.slice(0, 8)}.png`, { type: "image/png" });
          if (nav.canShare?.({ files: [file] }) && nav.share) {
            await nav.share({ files: [file], title: "A walk worth remembering", text: "Walked it through 🌿" });
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url; a.download = file.name; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          toast.success("Share card downloaded.");
          return;
        }
      } catch { /* fall through */ }
    }
    const moodLine = w.mood_before && w.mood_after ? `${w.mood_before} → ${w.mood_after}` : (w.mood_after ?? "");
    const lines = [
      `🌿 ${date} — ${mins} min walk · ${miles} mi`,
      moodLine && `mood: ${moodLine}`,
      w.reflection_note && `"${w.reflection_note}"`,
      "— shared from Mental Health Walk Club",
    ].filter(Boolean) as string[];
    await share({ title: "A walk worth remembering", text: lines.join("\n") });
  };

  // Filter + group by month
  const filteredWalks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return walks.filter((w) => {
      if (q) {
        const hay = [w.reflection_note, w.walk_type, w.mood_before, w.mood_after, w.intention].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (moodFilter !== "all") {
        if (w.mood_before_score == null || w.mood_after_score == null) return false;
        const delta = w.mood_after_score - w.mood_before_score;
        if (moodFilter === "lighter" && delta <= 0) return false;
        if (moodFilter === "heavier" && delta >= 0) return false;
      }
      return true;
    });
  }, [walks, query, moodFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Walk[]>();
    filteredWalks.forEach((w) => {
      const d = new Date(w.started_at);
      const k = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(w);
    });
    return Array.from(map.entries());
  }, [filteredWalks]);

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

  const trackingWalks: TrackingWalk[] = walks.map((w) => ({
    started_at: w.started_at,
    duration_seconds: w.duration_seconds,
    distance_meters: w.distance_meters,
    steps: w.steps,
    mood_after_score: w.mood_after_score,
  }));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-3xl">Journal</h1>
        <p className="mt-1 text-sm text-muted-foreground">Where every walk gets to land.</p>
      </header>

      {/* Layer A — tracking */}
      <TrackingStrip period={period} onPeriodChange={setPeriod} walks={trackingWalks} />

      {/* Signals row — lite social, glance only */}
      <SignalsRow
        latestBadgeName={badges[0]?.name}
        rank={null /* could pull from get_my_rank later */}
        groupName={primaryGroup?.name}
        streakWeeks={streakWeeks}
      />

      {/* Layer E — badges (scroller) */}
      {badges.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Earned</div>
            <Link to="/badges" className="text-xs text-muted-foreground hover:text-forest">See all</Link>
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {badges.slice(0, 6).map((b, i) => (
              <div key={i} className="min-w-[160px] shrink-0 rounded-2xl border border-border bg-card p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent"><Award className="h-3.5 w-3.5 text-forest" /></div>
                <div className="mt-2 font-serif text-sm">{b.name}</div>
                <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{b.description}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Walking with you — non-competitive leaderboard */}
      {primaryGroup && (
        <WalkingWithYou userId={user.id} groupId={primaryGroup.id} groupName={primaryGroup.name} />
      )}

      {/* Layer C — entries feed with search */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <SectionHeading eyebrow="Your walks" title="Entries" />
          <span className="text-xs text-muted-foreground tabular-nums">{filteredWalks.length} of {walks.length}</span>
        </div>

        <EntrySearch query={query} onQueryChange={setQuery} mood={moodFilter} onMoodChange={setMoodFilter} />

        {walks.length === 0 ? (
          <EmptyState icon={Footprints} title="Your first walk is waiting" body="A small walk is still a walk. Step out for five minutes — your journal will fill itself." action={<Link to="/" className="rounded-full bg-forest px-4 py-2 text-sm text-primary-foreground hover:opacity-90">Take a walk</Link>} />
        ) : filteredWalks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No walks match that search.
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr),360px]">
            <div className="space-y-5">
              {grouped.map(([month, ws]) => (
                <div key={month}>
                  <div className="sticky top-0 z-10 -mx-1 mb-2 bg-background/90 px-1 py-1 font-serif text-sm text-muted-foreground backdrop-blur">{month}</div>
                  <div className="space-y-3">
                    {ws.map((w) => (
                      <EntryCard
                        key={w.id}
                        walk={w}
                        snapshotUrl={snapshotUrls[w.id]}
                        photoCount={photoCounts[w.id] ?? 0}
                        photoUrls={photoUrlsByWalk[w.id] ?? []}
                        contextLine={contextLineFor(w)}
                        active={selectedId === w.id}
                        onSelect={() => setSelectedId(selectedId === w.id ? null : w.id)}
                        onShare={() => onShareEntry(w)}
                      />
                    ))}
                  </div>
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

      {/* Stats — collapsed disclosure for the lifetime/heatmap view */}
      {walks.length > 0 && (
        <section className="rounded-3xl border border-border bg-card/60 p-4">
          <button
            type="button"
            onClick={() => setStatsOpen((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Lifetime stats</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${statsOpen ? "rotate-180" : ""}`} />
          </button>
          {statsOpen && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <Stat label="walks" value={walks.length} />
                <Stat label="minutes" value={walks.reduce((s, w) => s + Math.round((w.duration_seconds ?? 0) / 60), 0)} />
                <Stat label="miles" value={walks.reduce((s, w) => s + (w.distance_meters ?? 0) * 0.000621371, 0).toFixed(1)} />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">Last 12 weeks</div>
                  <div className="text-[10px] tabular-nums text-muted-foreground">M T W T F S S</div>
                </div>
                <Heatmap walks={walks} />
              </div>
              <MoodArcSection walks={walks} />
            </div>
          )}
        </section>
      )}

      <p className="pt-4 text-center font-serif text-xs italic text-muted-foreground">Still here. Still walking.</p>

      {/* Mobile detail drawer — vaul gives swipe-to-close out of the box */}
      <Drawer open={!!selectedId} onOpenChange={(v: boolean) => { if (!v) setSelectedId(null); }} shouldScaleBackground>
        <DrawerContent className="max-h-[90dvh] rounded-t-3xl border-border bg-background p-0 lg:hidden">
          <DrawerTitle className="sr-only">Walk details</DrawerTitle>
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
            <WalkDetailPane walk={walks.find((w) => w.id === selectedId)} />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function contextLineFor(w: Walk): string | null {
  const type = w.walk_type.replace(/_/g, " ");
  const parts = [type];
  if (w.intention) parts.push(w.intention);
  return parts.join(" · ");
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="font-serif text-2xl tabular-nums leading-none">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function MoodArcSection({ walks }: { walks: Walk[] }) {
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
  if (moodAvg === null) return null;
  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-baseline justify-between">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-clay/80">Mood arc · 30 days</div>
        <div className="font-serif text-sm text-muted-foreground"><span className="text-foreground tabular-nums">{moodAvg.toFixed(1)}</span> avg after</div>
      </div>
      <MoodArc points={moodArc.map((d) => d.score)} />
    </div>
  );
}

function WalkDetailPane({ walk }: { walk: Walk | undefined }) {
  const [photos, setPhotos] = useState<{ url: string; t: number }[]>([]);
  const [zoom, setZoom] = useState<number | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [reflectionDraft, setReflectionDraft] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [savingRef, setSavingRef] = useState(false);

  useEffect(() => {
    setPhotos([]);
    setSnapshotUrl(null);
    setEditing(false);
    setReflectionDraft(walk?.reflection_note ?? "");
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
    const photoUrl = photos[0]?.url ?? null;
    if ((!snapshotUrl && !photoUrl) || !walk) return;
    haptics.tap();
    try {
      const date = new Date(walk.started_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      const mins = Math.round((walk.duration_seconds ?? 0) / 60);
      const miles = ((walk.distance_meters ?? 0) * 0.000621371).toFixed(2);
      const blob = await bakeShareCard(snapshotUrl, {
        miles, minutes: mins, steps: walk.steps, date,
        moodBefore: walk.mood_before, moodAfter: walk.mood_after, walkType: walk.walk_type,
        weather: walk.weather_at_end ? { tempF: walk.weather_at_end.tempF, label: walk.weather_at_end.label } : null,
      }, photoUrl);
      if (!blob) throw new Error("bake failed");
      const file = new File([blob], `walk-${walk.id.slice(0,8)}.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean; share?: (d: { files?: File[]; title?: string; text?: string }) => Promise<void> };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: "My walk", text: "Walked it through 🌿" });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch { /* user cancel */ }
  };

  const saveReflection = async () => {
    if (!walk) return;
    setSavingRef(true);
    const value = reflectionDraft.trim() || null;
    const prev = walk.reflection_note;
    walk.reflection_note = value; // optimistic mutation on the row
    setEditing(false);
    const { error } = await supabase.from("walk_sessions").update({ reflection_note: value }).eq("id", walk.id);
    setSavingRef(false);
    if (error) {
      walk.reflection_note = prev;
      toast.error("Couldn't save reflection");
    } else {
      toast.success("Reflection saved");
    }
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
          <img src={snapshotUrl} alt="Route map" className="aspect-square w-full object-cover" loading="lazy" style={{ filter: "saturate(0.55) contrast(1.02)" }} />
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
      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Reflection</div>
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} className="text-[11px] text-muted-foreground hover:text-forest">
              {walk.reflection_note ? "Edit" : "Add"}
            </button>
          )}
        </div>
        {editing ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={reflectionDraft}
              onChange={(e) => setReflectionDraft(e.target.value)}
              rows={4}
              placeholder="Write a line you'll want to find again."
              className="w-full resize-none rounded-2xl border border-forest/15 bg-background/80 p-3 font-serif italic leading-relaxed placeholder:text-muted-foreground/70 focus:border-forest focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setEditing(false); setReflectionDraft(walk.reflection_note ?? ""); }} className="rounded-full px-3 py-1.5 text-xs text-muted-foreground">Cancel</button>
              <button type="button" disabled={savingRef} onClick={saveReflection} className="rounded-full bg-forest px-4 py-1.5 text-xs text-primary-foreground disabled:opacity-60">
                {savingRef ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : walk.reflection_note ? (
          <p className="mt-1 whitespace-pre-wrap font-serif italic leading-relaxed">{walk.reflection_note}</p>
        ) : (
          <p className="mt-1 text-sm italic text-muted-foreground">No reflection yet — leave one for future-you.</p>
        )}
      </div>

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
