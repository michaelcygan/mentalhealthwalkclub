import { useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import type { Group, GroupPulse } from "@/hooks/use-groups-feed";
import { NicheTile } from "./niche-tile";

interface Props {
  groups: Group[];
  pulse: Map<string, GroupPulse>;
  mine: Set<string>;
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

export function NicheCollection({ groups, pulse, mine }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("all");

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

  return (
    <section className="space-y-3 niche-section">
      <div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">
          <Sparkles className="h-3 w-3 sparkle-twinkle" /> Niches
        </div>
        <h2 className="mt-0.5 font-serif text-xl">Find your tribe</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">The weirdly specific ones. They tend to hit hardest.</p>
      </div>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar md:mx-0 md:px-0">
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
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
        key={tab}
        className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 niche-grid-fade"
      >
        {filtered.map((g, i) => (
          <div key={g.id} className="card-in" style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}>
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
