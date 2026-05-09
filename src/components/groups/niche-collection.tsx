import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Sparkles, ChevronRight } from "lucide-react";
import type { Group, GroupPulse } from "@/hooks/use-groups-feed";
import { NicheTile } from "./niche-tile";
import { viewTransition, haptic } from "@/lib/mobile";

interface Props {
  groups: Group[];
  pulse: Map<string, GroupPulse>;
  mine: Set<string>;
  onSeeAll?: (label: string, groups: Group[]) => void;
}

type TabKey = "all" | "time" | "people" | "phone-free" | "audio" | "mood";

const TAB_MAP: Record<Exclude<TabKey, "all">, Set<string>> = {
  time: new Set(["five-am-club", "sunrise-club", "sunset-chasers", "night-owls", "lunchbreak-walkers", "shift-workers", "rainy-day-walkers"]),
  people: new Set(["dog-parents", "stroller-crew", "empty-nesters", "solo-travelers", "caregivers", "healthcare-workers", "first-year-teachers", "founders-walk", "remote-workers", "grad-school"]),
  "phone-free": new Set(["walk-instead-of-doomscroll", "phone-free-walkers", "silent-walking", "walk-and-pray", "gratitude-walk"]),
  audio: new Set(["one-podcast-one-walk", "audiobook-walkers"]),
  mood: new Set(["rage-walk", "hot-girl-walk", "gratitude-walk"]),
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "time", label: "Time of day" },
  { key: "people", label: "With others" },
  { key: "phone-free", label: "Phone-free" },
  { key: "audio", label: "Audio" },
  { key: "mood", label: "Mood" },
];

const ROWS_VISIBLE = 4;

export function NicheCollection({ groups, pulse, mine, onSeeAll }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("all");
  const listRef = useRef<HTMLUListElement>(null);
  const [cols, setCols] = useState(3);

  // Track responsive column count for overflow math.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const compute = () => {
      const w = window.innerWidth;
      setCols(w >= 768 ? 6 : w >= 640 ? 4 : 3);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // Reset scroll on tab change.
  useEffect(() => { listRef.current?.scrollTo({ top: 0, behavior: "auto" }); }, [tab]);

  const filtered = useMemo(() => {
    if (tab === "all") return groups;
    const set = TAB_MAP[tab];
    return groups.filter((g) => set.has(g.slug));
  }, [groups, tab]);

  if (groups.length === 0) return null;

  const prefetch = (slug: string) => {
    try {
      router.preloadRoute({ to: "/groups/$slug" as never, params: { slug } as never });
    } catch {
      /* preload best-effort */
    }
  };

  const overflows = filtered.length > ROWS_VISIBLE * cols;
  const activeLabel = TABS.find((t) => t.key === tab)?.label ?? "Niches";

  return (
    <section className="space-y-3 niche-section">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">
            <Sparkles className="h-3 w-3 sparkle-twinkle" /> Niches
          </div>
          <h2 className="mt-0.5 font-serif text-xl">Find your tribe</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">The weirdly specific ones. They tend to hit hardest.</p>
        </div>
        {overflows && onSeeAll && (
          <button
            onClick={() => onSeeAll(`${activeLabel} niches`, filtered)}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-xs text-forest hover:bg-forest/5"
          >
            See all {filtered.length}<ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>

      <div role="tablist" aria-label="Niche categories" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar md:mx-0 md:px-0">
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              onClick={() => { haptic(6); viewTransition(() => setTab(t.key)); }}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
                on
                  ? "border-forest bg-forest text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                  : "border-border bg-card text-foreground/80 hover:border-forest/40"
              } chip-spring`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <ul
        ref={listRef}
        key={tab}
        className={`${overflows ? "scroll-soft-mask" : ""} list-slide-in niche-grid-fade grid grid-cols-3 gap-2 overflow-y-auto pr-0.5 sm:grid-cols-4 md:grid-cols-6 no-scrollbar`}
        style={overflows ? {
          // 4 rows of square tiles + 3 gaps; container width assumed = viewport - 2rem padding.
          maxHeight: `calc((100vw - 2rem - ${cols - 1} * 0.5rem) / ${cols} * ${ROWS_VISIBLE} + ${ROWS_VISIBLE - 1} * 0.5rem)`,
          overscrollBehavior: "contain",
          touchAction: "pan-y",
          WebkitOverflowScrolling: "touch",
        } : undefined}
      >
        {filtered.map((g, i) => (
          <div key={g.id} className={i < cols * 2 ? "card-in" : undefined} style={i < cols * 2 ? { animationDelay: `${Math.min(i, 10) * 30}ms` } : undefined}>
            <NicheTile group={g} pulse={pulse.get(g.id)} joined={mine.has(g.id)} onPrefetch={() => prefetch(g.slug)} />
          </div>
        ))}
        {filtered.length === 0 && (
          <li className="col-span-full py-8 text-center text-xs text-muted-foreground">Nothing here yet.</li>
        )}
      </ul>
    </section>
  );
}
