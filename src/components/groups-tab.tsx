import { useMemo, useState } from "react";
import { Search, Radio, MapPin, Sparkles, Headphones, X, Flame, Heart, Compass, Moon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { GroupCard } from "@/components/group-card";
import { VibeCollection } from "@/components/groups/vibe-collection";
import { CityGallery } from "@/components/groups/city-gallery";
import { useGroupsFeed, type Group } from "@/hooks/use-groups-feed";
import { toast } from "sonner";

type Chip = "near" | "live" | "upcoming" | "quiet" | "audio";

const CHIPS: { id: Chip; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "near", label: "Near me", icon: MapPin },
  { id: "live", label: "Live now", icon: Radio },
  { id: "upcoming", label: "Has upcoming", icon: Sparkles },
  { id: "quiet", label: "Quiet", icon: Sparkles },
  { id: "audio", label: "Audio-friendly", icon: Headphones },
];

const VIBES: { key: string; eyebrow: string; title: string; blurb: string; icon: React.ComponentType<{ className?: string }>; themes: string[]; nameMatch?: RegExp }[] = [
  { key: "support", eyebrow: "Quiet support", title: "When it's heavy", blurb: "Anxiety, burnout, grief, the in-between days.", icon: Heart, themes: ["anxiety", "burnout", "grief", "depression", "loneliness"] },
  { key: "rituals", eyebrow: "Rituals & resets", title: "Daily resets", blurb: "Sunrise, sunset, lunchbreak, after-work wind-down.", icon: Sparkles, themes: ["reset"] },
  { key: "quiet", eyebrow: "Quiet practice", title: "Slow & silent", blurb: "Phone-free, audiobook, walk & pray, silent walking.", icon: Moon, themes: ["quiet"] },
  { key: "connection", eyebrow: "Find your people", title: "With others", blurb: "Dog parents, stroller crew, sober walkers, new friends.", icon: Compass, themes: ["connection"] },
];

export function GroupsTab() {
  const { user } = useAuth();
  const { requireAuth } = useAuthPrompt();
  const { groups, mine, pulse, myCity, myThemes, loading, refresh } = useGroupsFeed();
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Set<Chip>>(new Set());

  const toggleChip = (c: Chip) => setActive((s) => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });

  const toggleJoin = (g: Group) => requireAuth(async () => {
    if (!user) return;
    const isJoined = mine.has(g.id);
    if (isJoined) {
      await supabase.from("group_memberships").delete().eq("group_id", g.id).eq("user_id", user.id);
      toast(`Left ${g.name}`);
    } else {
      await supabase.from("group_memberships").insert({ group_id: g.id, user_id: user.id });
      toast(`Joined ${g.name}`);
    }
    refresh();
  });

  // ─── Search/filter mode (flattens to results grid) ───
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
    ).slice(0, 6);
  }, [discover, myThemes, myCity, user]);

  const nearYou = useMemo(() => {
    if (!myCity) return [];
    return discover.filter((g) => g.theme === "chapter" && (g.city === myCity || g.location_label?.includes(myCity))).slice(0, 6);
  }, [discover, myCity]);

  const trending = useMemo(() => discover
    .filter((g) => (pulse.get(g.id)?.walkersWeek ?? 0) > 0)
    .sort((a, b) => (pulse.get(b.id)?.walkersWeek ?? 0) - (pulse.get(a.id)?.walkersWeek ?? 0))
    .slice(0, 8), [discover, pulse]);

  // Niches = anything not chapter/connection/support that's quirky → use group_type-ish heuristic via name patterns
  const NICHE_KEYS = new Set([
    "five-am-club","sunrise-club","sunset-chasers","night-owls","lunchbreak-walkers",
    "dog-parents","stroller-crew","empty-nesters","solo-travelers","remote-workers",
    "shift-workers","grad-school","first-year-teachers","healthcare-workers","founders-walk",
    "caregivers","walk-instead-of-doomscroll","phone-free-walkers","one-podcast-one-walk",
    "audiobook-walkers","hot-girl-walk","silent-walking","rage-walk","gratitude-walk",
    "walk-and-pray","rainy-day-walkers",
  ]);
  const niches = useMemo(() => discover.filter((g) => NICHE_KEYS.has(g.slug)), [discover]);

  // Aggregate live counter for header
  const totalWalkers = useMemo(() => groups.reduce((s, g) => s + (g.member_count || 0), 0), [groups]);
  const cityCount = useMemo(() => new Set(groups.filter((g) => g.theme === "chapter" && g.city).map((g) => g.city)).size, [groups]);
  const liveNow = useMemo(() => Array.from(pulse.values()).reduce((s, p) => s + (p.live || 0), 0), [pulse]);

  return (
    <div className="space-y-7">
      <header className="space-y-3">
        <div className="eyebrow-rise">
          <h1 className="font-serif text-3xl">Groups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalWalkers > 0 ? (
              <>
                <span className="text-foreground">{totalWalkers.toLocaleString()}</span> walkers
                {cityCount > 0 && <> across <span className="text-foreground">{cityCount}</span> {cityCount === 1 ? "city" : "cities"}</>}
                {liveNow > 0 && <> · <span className="text-forest">{liveNow} walking right now</span></>}
              </>
            ) : "Quiet affinity tags. They surface walks that fit you."}
          </p>
        </div>

        <div className="sticky top-0 z-10 -mx-4 bg-background/85 px-4 py-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
          <div className="relative focus-hue-drift rounded-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              inputMode="search"
              enterKeyHint="search"
              placeholder="Search 100+ groups…"
              className="h-11 w-full rounded-full border border-border bg-card pl-10 pr-10 text-sm outline-none transition focus:border-forest/40"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Clear" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-secondary">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="-mx-4 mt-2 flex snap-x gap-1.5 overflow-x-auto px-4 pb-1 fade-edge-x md:mx-0 md:px-0">
            {CHIPS.map(({ id, label, icon: Icon }) => {
              const on = active.has(id);
              const dim = id === "near" && !myCity;
              return (
                <button
                  key={id}
                  disabled={dim}
                  onClick={() => toggleChip(id)}
                  className={`tap-press inline-flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                    on ? "border-forest bg-forest text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                       : "border-border bg-card text-foreground/80 hover:border-forest/40"
                  } ${dim ? "opacity-40" : ""}`}
                >
                  <Icon className="h-3 w-3" />{label}
                </button>
              );
            })}
            {(active.size > 0 || q) && (
              <button
                onClick={() => { setActive(new Set()); setQ(""); }}
                className="tap-press inline-flex shrink-0 snap-start items-center gap-1 rounded-full border border-dashed border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        </div>
      </header>

      {loading && groups.length === 0 && (
        <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-secondary/60" />)}</div>
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
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No groups match. Try clearing filters or a different word.
            </div>
          )}
        </section>
      ) : (
        <>
          {/* ─── Pulse strip ─── */}
          {pulseGroups.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <Radio className="h-3.5 w-3.5 text-forest" />
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">Pulse · happening now</span>
              </div>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
                {pulseGroups.map(({ g, p }) => (
                  <GroupCard key={g.id} group={g} pulse={p} joined={mine.has(g.id)} onToggle={() => toggleJoin(g)} variant="pulse" />
                ))}
              </div>
            </section>
          )}

          {/* ─── Your groups (mini grid) ─── */}
          {yours.length > 0 && (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">Yours</div>
                  <h2 className="font-serif text-xl">Your groups</h2>
                </div>
                <span className="text-xs text-muted-foreground">{yours.length}</span>
              </div>
              <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-3">
                {yours.map((g) => (
                  <GroupCard key={g.id} group={g} pulse={pulse.get(g.id)} joined onToggle={() => toggleJoin(g)} variant="mini" />
                ))}
              </ul>
            </section>
          )}

          {/* ─── For you ─── */}
          {forYou.length > 0 && (
            <section className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">
                <Sparkles className="h-3 w-3" /> Picked for you
              </div>
              <div className="relative -mx-4 px-4">
                <ul className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain pb-1.5">
                  {forYou.map((g) => (
                    <GroupCard key={g.id} group={g} pulse={pulse.get(g.id)} joined={false} onToggle={() => toggleJoin(g)} variant="rail" />
                  ))}
                </ul>
                <div className="pointer-events-none absolute right-0 top-0 bottom-1.5 w-8 bg-gradient-to-l from-background to-transparent" />
              </div>
            </section>
          )}

          {/* ─── Near you ─── */}
          {nearYou.length > 0 && (
            <section className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">
                <MapPin className="h-3 w-3" /> Near you · {myCity}
              </div>
              <div className="relative -mx-4 px-4">
                <ul className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain pb-1.5">
                  {nearYou.map((g) => (
                    <GroupCard key={g.id} group={g} pulse={pulse.get(g.id)} joined={mine.has(g.id)} onToggle={() => toggleJoin(g)} variant="rail" />
                  ))}
                </ul>
                <div className="pointer-events-none absolute right-0 top-0 bottom-1.5 w-8 bg-gradient-to-l from-background to-transparent" />
              </div>
            </section>
          )}

          {/* ─── Trending ─── */}
          {trending.length > 0 && (
            <section className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">
                <Flame className="h-3 w-3" /> Trending this week
              </div>
              <div className="relative -mx-4 px-4">
                <ul className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain pb-1.5">
                  {trending.map((g) => (
                    <GroupCard key={g.id} group={g} pulse={pulse.get(g.id)} joined={mine.has(g.id)} onToggle={() => toggleJoin(g)} variant="rail" />
                  ))}
                </ul>
                <div className="pointer-events-none absolute right-0 top-0 bottom-1.5 w-8 bg-gradient-to-l from-background to-transparent" />
              </div>
            </section>
          )}

          {/* ─── Vibes (theme collections) ─── */}
          {VIBES.map((v) => {
            const items = discover.filter((g) => g.theme && v.themes.includes(g.theme));
            return (
              <VibeCollection
                key={v.key}
                eyebrow={v.eyebrow}
                title={v.title}
                blurb={v.blurb}
                icon={v.icon}
                groups={items}
                pulse={pulse}
                mine={mine}
                onToggle={toggleJoin}
              />
            );
          })}

          {/* ─── Niches ─── */}
          {niches.length > 0 && (
            <section className="space-y-2.5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">
                    <Sparkles className="h-3 w-3" /> Niches
                  </div>
                  <h2 className="mt-0.5 font-serif text-xl">Find your tribe</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">The weirdly specific ones. They tend to hit hardest.</p>
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {niches.map((g) => (
                  <GroupCard key={g.id} group={g} pulse={pulse.get(g.id)} joined={mine.has(g.id)} onToggle={() => toggleJoin(g)} variant="gallery" />
                ))}
              </ul>
            </section>
          )}

          {/* ─── Browse by city ─── */}
          <CityGallery groups={discover} pulse={pulse} mine={mine} onToggle={toggleJoin} />
        </>
      )}
    </div>
  );
}
