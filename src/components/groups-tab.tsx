import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Radio, MapPin, Sparkles, Headphones, X, Moon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { GroupCard } from "@/components/group-card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CityGallery } from "@/components/groups/city-gallery";
import { PulseRail } from "@/components/groups/pulse-rail";
import { NicheCollection } from "@/components/groups/niche-collection";
import { TodayPanel } from "@/components/groups/today-panel";
import { MoodsCollection } from "@/components/groups/moods-collection";
import { useGroupsFeed, type Group } from "@/hooks/use-groups-feed";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { haptic } from "@/lib/mobile";
import { toast } from "sonner";

type Chip = "near" | "live" | "upcoming" | "quiet" | "audio";

const CHIPS: { id: Chip; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "near", label: "Near me", icon: MapPin },
  { id: "live", label: "Live now", icon: Radio },
  { id: "upcoming", label: "Upcoming", icon: Sparkles },
  { id: "quiet", label: "Quiet", icon: Moon },
  { id: "audio", label: "Audio", icon: Headphones },
];

const PLACEHOLDERS = ["Search 100+ groups…", "Try “quiet”…", "Try “sunrise”…", "Try “dog parents”…", "Try “phone-free”…"];

export function GroupsTab() {
  const { user } = useAuth();
  const { requireAuth } = useAuthPrompt();
  const { groups, mine, pulse, myCity, myThemes, loading, refresh } = useGroupsFeed();
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Set<Chip>>(new Set());
  const dir = useScrollDirection(8);
  const collapsed = dir === "down";

  // Search placeholder rotator (paused when tab hidden — saves wakeups)
  const [phIdx, setPhIdx] = useState(0);
  useEffect(() => {
    if (q) return;
    let id: number | null = null;
    const start = () => {
      if (id != null) return;
      id = window.setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 4000);
    };
    const stop = () => { if (id != null) { window.clearInterval(id); id = null; } };
    const onVis = () => (document.visibilityState === "hidden" ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, [q]);

  const toggleChip = (c: Chip) => {
    haptic(6);
    setActive((s) => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });
  };

  const toggleJoin = (g: Group) => requireAuth(async () => {
    if (!user) return;
    const isJoined = mine.has(g.id);
    if (isJoined) {
      await supabase.from("group_memberships").delete().eq("group_id", g.id).eq("user_id", user.id);
      toast(`Left ${g.name}`);
    } else {
      await supabase.from("group_memberships").insert({ group_id: g.id, user_id: user.id });
      haptic(8);
      toast(`Joined ${g.name}`);
    }
    refresh();
  });

  // ─── Search/filter mode ───
  const isFiltering = q.trim() !== "" || active.size > 0;
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return groups.filter((g) => {
      if (needle) {
        const hay = `${g.name} ${g.description ?? ""} ${g.theme ?? ""} ${g.city ?? ""} ${g.location_label ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      const p = pulse.get(g.id);
      if (active.has("live") && !(p?.live)) return false;
      if (active.has("upcoming") && !(p?.nextStart)) return false;
      if (active.has("near") && (!myCity || g.city !== myCity)) return false;
      if (active.has("quiet") && !(g.theme === "quiet" || g.theme === "reset")) return false;
      if (active.has("audio") && !(p?.live || p?.nextStart)) return false;
      return true;
    });
  }, [groups, pulse, q, active, myCity]);

  // Counts for chip badges (memoized — recomputed only when groups/pulse/myCity change)
  const chipCounts = useMemo(() => {
    const counts: Record<Chip, number> = { near: 0, live: 0, upcoming: 0, quiet: 0, audio: 0 };
    for (const g of groups) {
      const p = pulse.get(g.id);
      if (p?.live) counts.live += 1;
      if (p?.nextStart) counts.upcoming += 1;
      if (myCity && g.city === myCity) counts.near += 1;
      if (g.theme === "quiet" || g.theme === "reset") counts.quiet += 1;
      if (p?.live || p?.nextStart) counts.audio += 1;
    }
    return counts;
  }, [groups, pulse, myCity]);
  const chipCount = (id: Chip): number => chipCounts[id];

  // ─── Module data ───
  const yours = useMemo(() => groups.filter((g) => mine.has(g.id)), [groups, mine]);
  const discover = useMemo(() => groups.filter((g) => !mine.has(g.id)), [groups, mine]);

  const pulseGroups = useMemo(() => groups
    .map((g) => ({ g, p: pulse.get(g.id) }))
    .filter(({ p }) => p && (p.live > 0 || p.nextStart))
    .sort((a, b) => (b.p!.live - a.p!.live) || ((a.p!.nextStart ?? "z").localeCompare(b.p!.nextStart ?? "z")))
    .slice(0, 8), [groups, pulse]);

  const forYou = useMemo(() => {
    if (!user) return [];
    return discover.filter((g) =>
      (g.theme && myThemes.includes(g.theme)) || (myCity && g.city === myCity)
    ).slice(0, 12);
  }, [discover, myThemes, myCity, user]);

  const nearYou = useMemo(() => {
    if (!myCity) return [];
    return discover.filter((g) => g.theme === "chapter" && (g.city === myCity || g.location_label?.includes(myCity))).slice(0, 12);
  }, [discover, myCity]);

  const trending = useMemo(() => discover
    .filter((g) => (pulse.get(g.id)?.walkersWeek ?? 0) > 0)
    .sort((a, b) => (pulse.get(b.id)?.walkersWeek ?? 0) - (pulse.get(a.id)?.walkersWeek ?? 0))
    .slice(0, 12), [discover, pulse]);

  const NICHE_KEYS = new Set([
    "five-am-club","sunrise-club","sunset-chasers","night-owls","lunchbreak-walkers",
    "dog-parents","stroller-crew","empty-nesters","solo-travelers","remote-workers",
    "shift-workers","grad-school","first-year-teachers","healthcare-workers","founders-walk",
    "caregivers","walk-instead-of-doomscroll","phone-free-walkers","one-podcast-one-walk",
    "audiobook-walkers","hot-girl-walk","silent-walking","rage-walk","gratitude-walk",
    "walk-and-pray","rainy-day-walkers",
  ]);
  const niches = useMemo(() => discover.filter((g) => NICHE_KEYS.has(g.slug)), [discover]);

  // Aggregate counters for header
  const totalWalkers = useMemo(() => groups.reduce((s, g) => s + (g.member_count || 0), 0), [groups]);
  const cityCount = useMemo(() => new Set(groups.filter((g) => g.theme === "chapter" && g.city).map((g) => g.city)).size, [groups]);
  const liveNow = useMemo(() => Array.from(pulse.values()).reduce((s, p) => s + (p.live || 0), 0), [pulse]);
  const liveDisplay = useCountUp(liveNow);

  // ─── See-all sheet (shared by Today + Moods) ───
  const [sheet, setSheet] = useState<{ title: string; groups: Group[] } | null>(null);

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="header-collapse" data-collapsed={collapsed}>
          <div className="eyebrow-rise">
            <h1 className="font-serif text-3xl">Groups</h1>
            <p className="mt-1 text-sm text-muted-foreground text-balance">
              {totalWalkers > 0 ? (
                <>
                  <span className="text-foreground">{totalWalkers.toLocaleString()}</span> walkers
                  {cityCount > 0 && <> across <span className="text-foreground">{cityCount}</span> {cityCount === 1 ? "city" : "cities"}</>}
                  {liveNow > 0 && <> · <span className="text-forest">{liveDisplay} walking right now</span></>}
                </>
              ) : "Quiet affinity tags. They surface walks that fit you."}
            </p>
          </div>
        </div>

        <div className="sticky top-0 z-10 -mx-4 bg-background/85 px-4 py-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
          <div className="relative focus-hue-drift rounded-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              inputMode="search"
              enterKeyHint="search"
              placeholder={PLACEHOLDERS[phIdx]}
              className="placeholder-rotate h-11 w-full rounded-full border border-border bg-card pl-10 pr-24 text-sm outline-none transition focus:border-forest/40"
            />
            {q ? (
              <button onClick={() => setQ("")} aria-label="Clear" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-secondary">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : liveNow > 0 ? (
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-full bg-forest/10 px-2 py-1 text-[10px] text-forest">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full city-pulse-ring rounded-full bg-forest/70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-forest" />
                </span>
                <span className="font-medium tabular-nums">{liveDisplay}</span> live
              </div>
            ) : null}
          </div>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {CHIPS.map(({ id, label, icon: Icon }) => {
              const on = active.has(id);
              const dim = id === "near" && !myCity;
              const isLive = id === "live";
              const count = chipCount(id);
              const idleAnim = on ? ""
                : id === "near" ? "pin-drop"
                : id === "upcoming" || id === "quiet" ? "sparkle-twinkle"
                : id === "audio" ? "headphones-bob"
                : isLive ? "live-pulse" : "";
              return (
                <button
                  key={id}
                  disabled={dim}
                  onClick={() => toggleChip(id)}
                  className={`chip-spring inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                    on ? "border-forest bg-forest text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                       : "border-border bg-card text-foreground/80 hover:border-forest/40"
                  } ${dim ? "opacity-40" : ""}`}
                >
                  <Icon className={`h-3 w-3 ${idleAnim} ${isLive && !on ? "text-forest" : ""}`} />{label}
                  {count > 0 && (
                    <span className={`rounded-full px-1 text-[9px] ${on ? "bg-white/20" : "bg-secondary text-muted-foreground"}`}>{count}</span>
                  )}
                </button>
              );
            })}
            {(active.size > 0 || q) && (
              <button
                onClick={() => { setActive(new Set()); setQ(""); }}
                className="chip-spring inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        </div>
      </header>

      {loading && groups.length === 0 && (
        <div className="space-y-5" aria-hidden>
          {/* PulseRail skeleton */}
          <div className="space-y-2">
            <div className="h-3 w-32 animate-pulse rounded-full bg-secondary/60" />
            <div className="-mx-4 flex gap-2 px-4 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 w-56 shrink-0 animate-pulse rounded-2xl bg-secondary/60" />
              ))}
            </div>
          </div>
          {/* Today skeleton */}
          <div className="space-y-2">
            <div className="h-4 w-40 animate-pulse rounded-full bg-secondary/60" />
            <div className="flex gap-1.5">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-secondary/60" />)}
            </div>
            <div className="-mx-4 flex gap-2 px-4 overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 w-48 shrink-0 animate-pulse rounded-2xl bg-secondary/60" />)}
            </div>
          </div>
          {/* Moods skeleton */}
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded-full bg-secondary/60" />
            <div className="space-y-1.5">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-secondary/60" />)}</div>
          </div>
        </div>
      )}

      {/* ─── Filter / search results ─── */}
      {isFiltering ? (
        <section className="space-y-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "group" : "groups"}
          </div>
          {filtered.length > 0 ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {filtered.map((g) => (
                <GroupCard key={g.id} group={g} pulse={pulse.get(g.id)} joined={mine.has(g.id)} onToggle={() => toggleJoin(g)} />
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-forest/20 bg-accent/30 p-8 text-center">
              <div className="font-serif text-base text-foreground">Nothing matches that yet.</div>
              <p className="mt-1 text-xs text-muted-foreground">Try a softer word, or open the door wider.</p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {myThemes.length > 0 && (
                  <button onClick={() => { setQ(myThemes[0]); setActive(new Set()); }} className="chip-spring rounded-full border border-forest/40 bg-forest/5 px-3 py-1.5 text-xs text-forest hover:bg-forest/10">Try <span className="italic">{myThemes[0]}</span></button>
                )}
                <button onClick={() => { setQ("quiet"); setActive(new Set()); }} className="chip-spring rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:border-forest/40">Try <span className="italic">quiet</span></button>
                {myCity && <button onClick={() => { setQ(""); setActive(new Set(["near"] as Chip[])); }} className="chip-spring rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:border-forest/40">Near {myCity}</button>}
                <button onClick={() => { setQ(""); setActive(new Set()); }} className="chip-spring rounded-full bg-forest px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90">Show all</button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <>
          {/* ─── Pulse rail (auto-drift) ─── */}
          <PulseRail
            groups={[...pulseGroups.map((x) => x.g),
              ...discover.filter((g) => {
                const p = pulse.get(g.id);
                if (!p?.nextStart || p.live > 0) return false;
                const ms = new Date(p.nextStart).getTime() - Date.now();
                return ms > -5 * 60_000 && ms < 90 * 60_000 && p.walkersWeek < 3;
              })]}
            pulse={pulse}
            mine={mine}
            onToggle={toggleJoin}
          />

          {/* ─── Today (collapses Yours/For-you/Near/Trending) ─── */}
          <div className="cv-auto">
            <TodayPanel
              yours={yours}
              forYou={forYou}
              nearYou={nearYou}
              trending={trending}
              myCity={myCity}
              pulse={pulse}
              mine={mine}
              onToggle={toggleJoin}
              onSeeAll={(key) => {
                const map = { yours, "for-you": forYou, near: nearYou, trending } as const;
                const titles = { yours: "Your groups", "for-you": "Picked for you", near: `Near ${myCity ?? "you"}`, trending: "Trending this week" } as const;
                setSheet({ title: titles[key], groups: map[key] });
              }}
            />
          </div>

          {/* ─── Moods (collapses 4 vibe sections) ─── */}
          <div className="cv-auto">
            <MoodsCollection
              groups={discover}
              pulse={pulse}
              mine={mine}
              onToggle={toggleJoin}
              onSeeAll={(_k, themes, label) => {
                setSheet({ title: label, groups: discover.filter((g) => g.theme && themes.includes(g.theme)) });
              }}
            />
          </div>

          {/* ─── Niches ─── */}
          {niches.length > 0 && (
            <div className="cv-auto">
              <NicheCollection
                groups={niches}
                pulse={pulse}
                mine={mine}
                onSeeAll={(label, gs) => setSheet({ title: label, groups: gs })}
              />
            </div>
          )}

          {/* ─── Browse by city ─── */}
          <div aria-hidden className="mx-auto h-px w-12 bg-border/60" />
          <div className="cv-auto">
            <CityGallery groups={discover} pulse={pulse} mine={mine} onToggle={toggleJoin} />
          </div>
        </>
      )}

      {/* Shared see-all sheet */}
      <Sheet open={!!sheet} onOpenChange={(o) => { if (!o) setSheet(null); }}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0">
          <SheetHeader className="border-b border-border px-4 pb-3 pt-4">
            <SheetTitle className="font-serif text-2xl">{sheet?.title}</SheetTitle>
          </SheetHeader>
          <ul className="max-h-[calc(85vh-5rem)] space-y-1.5 overflow-y-auto px-4 py-3">
            {sheet?.groups.map((g) => (
              <GroupCard key={g.id} group={g} pulse={pulse.get(g.id)} joined={mine.has(g.id)} onToggle={() => toggleJoin(g)} variant="mini" />
            ))}
            {sheet && sheet.groups.length === 0 && <li className="py-10 text-center text-sm text-muted-foreground">Nothing here yet.</li>}
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Smooth count-up for live numbers — rAF, ~600ms, no deps. */
function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}
