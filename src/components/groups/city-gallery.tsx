import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Globe, ChevronRight, Search, X } from "lucide-react";
import { GroupCard } from "@/components/group-card";
import type { Group, GroupPulse } from "@/hooks/use-groups-feed";

interface Props {
  groups: Group[];
  pulse: Map<string, GroupPulse>;
  mine: Set<string>;
  onToggle: (g: Group) => void;
}

export function CityGallery({ groups, pulse, mine, onToggle }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const chapters = useMemo(
    () => groups.filter((g) => g.theme === "chapter" && g.city)
      .sort((a, b) => {
        const pa = pulse.get(a.id), pb = pulse.get(b.id);
        return ((pb?.live ?? 0) + (pb?.walkersWeek ?? 0)) - ((pa?.live ?? 0) + (pa?.walkersWeek ?? 0))
          || (b.member_count - a.member_count);
      }),
    [groups, pulse]
  );
  if (chapters.length === 0) return null;

  const featured = chapters.slice(0, 9);
  const filtered = q
    ? chapters.filter((g) => `${g.name} ${g.city ?? ""} ${g.location_label ?? ""} ${g.country ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    : chapters;

  return (
    <section className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-forest/80">
            <Globe className="h-3 w-3" /> Chapters
          </div>
          <h2 className="mt-0.5 font-serif text-xl">Browse by city</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Find your metro. Or wander into someone else's.</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-xs text-forest hover:bg-forest/5">
          All {chapters.length}<ChevronRight className="h-3 w-3" />
        </button>
      </div>
      <ul className="grid grid-cols-3 gap-2 md:grid-cols-5">
        {featured.map((g) => (
          <GroupCard key={g.id} group={g} pulse={pulse.get(g.id)} joined={mine.has(g.id)} onToggle={() => onToggle(g)} variant="gallery" />
        ))}
      </ul>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0">
          <SheetHeader className="border-b border-border px-4 pb-3 pt-4">
            <SheetTitle className="font-serif text-2xl">All chapters</SheetTitle>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                inputMode="search"
                placeholder={`Search ${chapters.length} cities…`}
                className="h-10 w-full rounded-full border border-border bg-card pl-10 pr-10 text-sm outline-none focus:border-forest/40 focus:ring-2 focus:ring-forest/15"
              />
              {q && (
                <button onClick={() => setQ("")} aria-label="Clear" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-secondary">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </SheetHeader>
          <div className="max-h-[calc(85vh-7.5rem)] overflow-y-auto px-4 py-3">
            <ul className="grid grid-cols-3 gap-2 md:grid-cols-4">
              {filtered.map((g) => (
                <GroupCard key={g.id} group={g} pulse={pulse.get(g.id)} joined={mine.has(g.id)} onToggle={() => onToggle(g)} variant="gallery" />
              ))}
            </ul>
            {filtered.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">Nothing matches.</div>}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
