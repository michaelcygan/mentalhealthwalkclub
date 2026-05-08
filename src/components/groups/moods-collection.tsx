import { useMemo, useState } from "react";
import { Heart, Sparkles, Moon, Compass, ChevronRight } from "lucide-react";
import { GroupCard } from "@/components/group-card";
import type { Group, GroupPulse } from "@/hooks/use-groups-feed";
import { viewTransition } from "@/lib/mobile";

type MoodKey = "support" | "rituals" | "quiet" | "connection";

const MOODS: { key: MoodKey; label: string; icon: React.ComponentType<{ className?: string }>; themes: string[] }[] = [
  { key: "support", label: "When it's heavy", icon: Heart, themes: ["anxiety", "burnout", "grief", "depression", "loneliness"] },
  { key: "rituals", label: "Daily resets", icon: Sparkles, themes: ["reset"] },
  { key: "quiet", label: "Slow & silent", icon: Moon, themes: ["quiet"] },
  { key: "connection", label: "With others", icon: Compass, themes: ["connection"] },
];

interface Props {
  groups: Group[];
  pulse: Map<string, GroupPulse>;
  mine: Set<string>;
  onToggle: (g: Group) => void;
  onSeeAll: (mood: MoodKey, themes: string[], label: string) => void;
}

export function MoodsCollection({ groups, pulse, mine, onToggle, onSeeAll }: Props) {
  const buckets = useMemo(() => MOODS.map((m) => ({
    ...m,
    groups: groups.filter((g) => g.theme && m.themes.includes(g.theme)),
  })).filter((m) => m.groups.length > 0), [groups]);

  const [tab, setTab] = useState<MoodKey | null>(null);
  if (buckets.length === 0) return null;

  const active = buckets.find((b) => b.key === tab) ?? buckets[0];

  // Sort: live > week > members
  const sorted = [...active.groups].sort((a, b) => {
    const pa = pulse.get(a.id), pb = pulse.get(b.id);
    return ((pb?.live ?? 0) - (pa?.live ?? 0))
      || ((pb?.walkersWeek ?? 0) - (pa?.walkersWeek ?? 0))
      || (b.member_count - a.member_count);
  });
  const visible = sorted.slice(0, 6);

  return (
    <section className="space-y-2.5 moods-section">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">Moods</div>
          <h2 className="mt-0.5 font-serif text-xl text-balance">By how it feels</h2>
        </div>
        {sorted.length > visible.length && (
          <button onClick={() => onSeeAll(active.key, active.themes, active.label)} className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-xs text-forest hover:bg-forest/5">
            See all {sorted.length}<ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 no-scrollbar md:mx-0 md:px-0">
        {buckets.map((b) => {
          const on = b.key === active.key;
          const Icon = b.icon;
          return (
            <button
              key={b.key}
              onClick={() => viewTransition(() => setTab(b.key))}
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

      <ul key={active.key} className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 niche-grid-fade @container">
        {visible.map((g, i) => (
          <div key={g.id} className="card-in" style={{ animationDelay: `${Math.min(i, 6) * 35}ms` }}>
            <GroupCard group={g} pulse={pulse.get(g.id)} joined={mine.has(g.id)} onToggle={() => onToggle(g)} variant="mini" />
          </div>
        ))}
      </ul>
    </section>
  );
}
