import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ChevronRight, Search, X, Heart, Radio, Sparkles, Moon, Compass } from "lucide-react";
import { GroupCard } from "@/components/group-card";
import type { Group, GroupPulse } from "@/hooks/use-groups-feed";

interface Props {
  eyebrow: string;
  title: string;
  blurb?: string;
  icon?: React.ComponentType<{ className?: string }>;
  groups: Group[];
  pulse: Map<string, GroupPulse>;
  mine: Set<string>;
  onToggle: (g: Group) => void;
}

export function VibeCollection({ eyebrow, title, blurb, icon: Icon, groups, pulse, mine, onToggle }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  if (groups.length === 0) return null;

  // Sort: live > week activity > members
  const sorted = [...groups].sort((a, b) => {
    const pa = pulse.get(a.id), pb = pulse.get(b.id);
    return ((pb?.live ?? 0) - (pa?.live ?? 0))
      || ((pb?.walkersWeek ?? 0) - (pa?.walkersWeek ?? 0))
      || (b.member_count - a.member_count);
  });
  const featured = sorted.slice(0, 6);
  const filtered = q ? sorted.filter((g) => `${g.name} ${g.description ?? ""} ${g.city ?? ""}`.toLowerCase().includes(q.toLowerCase())) : sorted;

  return (
    <section className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">
            {Icon ? <Icon className={`h-3 w-3 ${Icon === Heart ? "heart-beat text-clay" : Icon === Radio ? "live-pulse text-forest" : ""}`} /> : null}{eyebrow}
          </div>
          <h2 className="mt-0.5 font-serif text-xl">{title}</h2>
          {blurb && <p className="mt-0.5 text-xs text-muted-foreground">{blurb}</p>}
        </div>
        {sorted.length > featured.length && (
          <button onClick={() => setOpen(true)} className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-xs text-forest hover:bg-forest/5">
            See all {sorted.length}<ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="relative -mx-4 px-4">
        <ul className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain pb-1.5">
          {featured.map((g, i) => (
            <div key={g.id} className="card-in" style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}>
              <GroupCard group={g} pulse={pulse.get(g.id)} joined={mine.has(g.id)} onToggle={() => onToggle(g)} variant="rail" />
            </div>
          ))}
        </ul>
        <div className="pointer-events-none absolute right-0 top-0 bottom-1.5 w-8 bg-gradient-to-l from-background to-transparent" />
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0">
          <SheetHeader className="border-b border-border px-4 pb-3 pt-4">
            <SheetTitle className="font-serif text-2xl">{title}</SheetTitle>
            {blurb && <SheetDescription>{blurb}</SheetDescription>}
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                inputMode="search"
                placeholder={`Search ${sorted.length} groups…`}
                className="h-10 w-full rounded-full border border-border bg-card pl-10 pr-10 text-sm outline-none focus:border-forest/40 focus:ring-2 focus:ring-forest/15"
              />
              {q && (
                <button onClick={() => setQ("")} aria-label="Clear" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-secondary">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </SheetHeader>
          <ul className="max-h-[calc(85vh-7.5rem)] space-y-1.5 overflow-y-auto px-4 py-3">
            {filtered.map((g) => (
              <GroupCard key={g.id} group={g} pulse={pulse.get(g.id)} joined={mine.has(g.id)} onToggle={() => onToggle(g)} variant="mini" />
            ))}
            {filtered.length === 0 && <li className="py-10 text-center text-sm text-muted-foreground">Nothing matches.</li>}
          </ul>
        </SheetContent>
      </Sheet>
    </section>
  );
}
