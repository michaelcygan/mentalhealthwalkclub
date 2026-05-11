import { useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Sparkles, MapPin, Flame, Bookmark, ChevronRight } from "lucide-react";
import { GroupCard } from "@/components/group-card";
import type { Group, GroupPulse } from "@/hooks/use-groups-feed";
import { viewTransition, haptic } from "@/lib/mobile";

type TabKey = "yours" | "for-you" | "near" | "trending";

interface Bucket { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; groups: Group[] }

interface Props {
  yours: Group[];
  forYou: Group[];
  nearYou: Group[];
  trending: Group[];
  myCity: string | null;
  pulse: Map<string, GroupPulse>;
  mine: Set<string>;
  onToggle: (g: Group) => void;
  onSeeAll: (key: TabKey) => void;
}

export function TodayPanel({ yours, forYou, nearYou, trending, myCity, pulse, mine, onToggle, onSeeAll }: Props) {
  const buckets = useMemo<Bucket[]>(() => {
    const all: Bucket[] = [
      { key: "yours", label: "Yours", icon: Bookmark, groups: yours },
      { key: "for-you", label: "For you", icon: Sparkles, groups: forYou },
      { key: "near", label: myCity ? `Near · ${myCity}` : "Near you", icon: MapPin, groups: nearYou },
      { key: "trending", label: "Trending", icon: Flame, groups: trending },
    ];
    return all.filter((b) => b.groups.length > 0);
  }, [yours, forYou, nearYou, trending, myCity]);

  const [tab, setTab] = useState<TabKey | null>(null);
  const router = useRouter();
  if (buckets.length === 0) return null;

  const active = buckets.find((b) => b.key === tab) ?? buckets[0];
  const setTabAnimated = (k: TabKey) => { haptic(6); viewTransition(() => setTab(k)); };

  const prefetch = (slug: string) => {
    try { router.preloadRoute({ to: "/groups/$slug" as never, params: { slug } as never }); } catch { /* */ }
  };

  return (
    <section className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">Today</div>
          <h2 className="mt-0.5 font-serif text-xl text-balance">Made for now</h2>
        </div>
        {active.groups.length > 4 && (
          <button onClick={() => onSeeAll(active.key)} className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-xs text-forest hover:bg-forest/5">
            See all {active.groups.length}<ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>

      <div role="tablist" aria-label="Today filters" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar md:mx-0 md:px-0">
        {buckets.map((b) => {
          const on = b.key === active.key;
          const Icon = b.icon;
          return (
            <button
              key={b.key}
              role="tab"
              aria-selected={on}
              onClick={() => setTabAnimated(b.key)}
              className={`chip-spring shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                on
                  ? "border-forest bg-forest text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                  : "border-border bg-card text-foreground/80 hover:border-forest/40"
              }`}
            >
              <Icon className="h-3 w-3" />{b.label}
              <span className={`rounded-full px-1 text-[10px] ${on ? "bg-white/20" : "bg-secondary text-muted-foreground"}`}>{b.groups.length}</span>
            </button>
          );
        })}
      </div>

      <div className="relative -mx-4 px-4">
        <ul key={active.key} className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-1.5 niche-grid-fade">
          {active.groups.slice(0, 12).map((g, i) => (
            <div
              key={g.id}
              className="card-in"
              style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
              onPointerEnter={() => prefetch(g.slug)}
            >
              <GroupCard group={g} pulse={pulse.get(g.id)} joined={mine.has(g.id)} onToggle={() => onToggle(g)} variant="rail" />
            </div>
          ))}
        </ul>
        <div className="pointer-events-none absolute right-0 top-0 bottom-1.5 w-8 bg-gradient-to-l from-background to-transparent" />
      </div>
    </section>
  );
}
