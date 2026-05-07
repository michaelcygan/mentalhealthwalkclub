import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Radio, MapPin, Sparkles, Headphones, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { SectionHeading } from "@/components/section-heading";
import { GroupCard } from "@/components/group-card";
import { useGroupsFeed, type Group } from "@/hooks/use-groups-feed";
import { toast } from "sonner";

export const Route = createFileRoute("/groups")({
  component: GroupsTab,
  head: () => ({ meta: [{ title: "Groups — Walk Club" }] }),
});

type Chip = "near" | "live" | "upcoming" | "quiet" | "audio";

const CHIPS: { id: Chip; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "near", label: "Near me", icon: MapPin },
  { id: "live", label: "Live now", icon: Radio },
  { id: "upcoming", label: "Has upcoming", icon: Sparkles },
  { id: "quiet", label: "Quiet", icon: Sparkles },
  { id: "audio", label: "Audio-friendly", icon: Headphones },
];

const THEME_GROUPS: { key: string; label: string; themes: string[] }[] = [
  { key: "support", label: "Quiet support", themes: ["anxiety", "burnout", "grief", "depression", "loneliness"] },
  { key: "rituals", label: "Rituals & resets", themes: ["reset", "quiet"] },
  { key: "connection", label: "Gentle connection", themes: ["connection"] },
  { key: "chapters", label: "City chapters", themes: ["chapter"] },
];

function GroupsTab() {
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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return groups.filter((g) => {
      if (needle) {
        const hay = `${g.name} ${g.description ?? ""} ${g.theme ?? ""} ${g.city ?? ""}`.toLowerCase();
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

  const joined = filtered.filter((g) => mine.has(g.id));
  const discover = filtered.filter((g) => !mine.has(g.id));

  // Pulse strip = anything live or starting soon (across ALL groups, ignoring filters)
  const pulseGroups = useMemo(() => {
    return groups
      .map((g) => ({ g, p: pulse.get(g.id) }))
      .filter(({ p }) => p && (p.live > 0 || p.nextStart))
      .sort((a, b) => (b.p!.live - a.p!.live) || ((a.p!.nextStart ?? "z").localeCompare(b.p!.nextStart ?? "z")))
      .slice(0, 8);
  }, [groups, pulse]);

  // For You = themes intersect preferred OR city match
  const forYou = useMemo(() => {
    if (!user) return [];
    return discover.filter((g) =>
      (g.theme && myThemes.includes(g.theme)) || (myCity && g.city === myCity)
    ).slice(0, 6);
  }, [discover, myThemes, myCity, user]);

  const forYouIds = new Set(forYou.map((g) => g.id));
  const browseRest = discover.filter((g) => !forYouIds.has(g.id));

  return (
    <div className="space-y-7">
      <header className="space-y-3">
        <div>
          <h1 className="font-serif text-3xl">Groups</h1>
          <p className="mt-1 text-muted-foreground">Quiet affinity tags. They surface walks that fit you.</p>
        </div>

        {/* Search */}
        <div className="sticky top-0 z-10 -mx-4 bg-background/85 px-4 py-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              inputMode="search"
              enterKeyHint="search"
              placeholder="Search groups, cities, themes…"
              className="h-11 w-full rounded-full border border-border bg-card pl-10 pr-10 text-sm outline-none transition focus:border-forest/40 focus:ring-2 focus:ring-forest/15"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Clear" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-secondary">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {CHIPS.map(({ id, label, icon: Icon }) => {
              const on = active.has(id);
              const dim = id === "near" && !myCity;
              return (
                <button
                  key={id}
                  disabled={dim}
                  onClick={() => toggleChip(id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                    on ? "border-forest bg-forest text-primary-foreground"
                       : "border-border bg-card text-foreground/80 hover:border-forest/40"
                  } ${dim ? "opacity-40" : ""}`}
                >
                  <Icon className="h-3 w-3" />{label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Pulse strip */}
      {pulseGroups.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-forest" />
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">Pulse · happening in groups</span>
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {pulseGroups.map(({ g, p }) => (
              <GroupCard key={g.id} group={g} pulse={p} joined={mine.has(g.id)} onToggle={() => toggleJoin(g)} variant="pulse" />
            ))}
          </div>
        </section>
      )}

      {loading && groups.length === 0 && (
        <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-secondary/60" />)}</div>
      )}

      {/* Your groups */}
      {joined.length > 0 && (
        <section className="space-y-3">
          <SectionHeading eyebrow="Yours" title="Your groups" />
          <ul className="grid gap-3 md:grid-cols-2">
            {joined.map((g) => (
              <GroupCard key={g.id} group={g} pulse={pulse.get(g.id)} joined onToggle={() => toggleJoin(g)} />
            ))}
          </ul>
        </section>
      )}

      {/* For you */}
      {forYou.length > 0 && (
        <section className="space-y-3">
          <SectionHeading eyebrow="For you" title="Likely fits" />
          <ul className="grid gap-3 md:grid-cols-2">
            {forYou.map((g) => (
              <GroupCard key={g.id} group={g} pulse={pulse.get(g.id)} joined={false} onToggle={() => toggleJoin(g)} />
            ))}
          </ul>
        </section>
      )}

      {/* Browse by theme */}
      <section className="space-y-5">
        <SectionHeading eyebrow="Discover" title={joined.length > 0 ? "More to wander into" : "Browse groups"} />
        {THEME_GROUPS.map(({ key, label, themes }) => {
          const items = browseRest.filter((g) => g.theme && themes.includes(g.theme));
          if (items.length === 0) return null;
          return (
            <div key={key} className="space-y-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
              <ul className="grid gap-3 md:grid-cols-2">
                {items.map((g) => (
                  <GroupCard key={g.id} group={g} pulse={pulse.get(g.id)} joined={false} onToggle={() => toggleJoin(g)} />
                ))}
              </ul>
            </div>
          );
        })}
        {(() => {
          const themed = new Set(THEME_GROUPS.flatMap((t) => t.themes));
          const other = browseRest.filter((g) => !g.theme || !themed.has(g.theme));
          if (other.length === 0) return null;
          return (
            <div className="space-y-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Everything else</div>
              <ul className="grid gap-3 md:grid-cols-2">
                {other.map((g) => (
                  <GroupCard key={g.id} group={g} pulse={pulse.get(g.id)} joined={false} onToggle={() => toggleJoin(g)} />
                ))}
              </ul>
            </div>
          );
        })()}
      </section>

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No groups match. Try clearing filters or a different word.
        </div>
      )}
    </div>
  );
}
