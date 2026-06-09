import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMoodChips } from "@/lib/listen-search.functions";
import { Headphones, Waves, Music, BookOpen, Check } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export type Kind = "podcast" | "ambient" | "guided" | "blog";

const KINDS: { id: Kind; label: string; icon: typeof Headphones }[] = [
  { id: "podcast", label: "Podcasts", icon: Headphones },
  { id: "ambient", label: "Ambient", icon: Waves },
  { id: "guided", label: "Guided", icon: Music },
  { id: "blog", label: "Articles", icon: BookOpen },
];

export function ListenFilters({
  open, onOpenChange, moods, kinds, onChange,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  moods: string[];
  kinds: Kind[];
  onChange: (next: { moods: string[]; kinds: Kind[] }) => void;
}) {
  const [chips, setChips] = useState<string[]>([]);
  const fetchChips = useServerFn(listMoodChips);

  useEffect(() => {
    fetchChips().then(setChips).catch(() => setChips([]));
  }, [fetchChips]);

  const toggleMood = (m: string) => {
    const next = moods.includes(m) ? moods.filter((x) => x !== m) : [...moods, m];
    onChange({ moods: next, kinds });
  };
  const toggleKind = (k: Kind) => {
    const next = kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k];
    onChange({ moods, kinds: next });
  };
  const clearAll = () => onChange({ moods: [], kinds: [] });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild><span /></SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader><SheetTitle className="font-serif">Filter</SheetTitle></SheetHeader>
        <div className="mt-3 space-y-5">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Kind</p>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => {
                const active = kinds.includes(k.id);
                const Icon = k.icon;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => toggleKind(k.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                      active ? "border-forest bg-forest text-primary-foreground" : "border-border bg-card text-foreground"
                    }`}
                  >
                    <Icon className="h-3 w-3" /> {k.label}
                    {active && <Check className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          </div>
          {chips.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Mood</p>
              <div className="flex flex-wrap gap-2">
                {chips.map((m) => {
                  const active = moods.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMood(m)}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs capitalize transition ${
                        active ? "border-forest bg-forest text-primary-foreground" : "border-border bg-card text-foreground"
                      }`}
                    >
                      {m}
                      {active && <Check className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" size="sm" onClick={clearAll} className="rounded-full">Clear all</Button>
            <Button size="sm" onClick={() => onOpenChange(false)} className="rounded-full">Done</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ActiveChipsBar({
  moods, kinds, onRemoveMood, onRemoveKind,
}: {
  moods: string[]; kinds: Kind[];
  onRemoveMood: (m: string) => void;
  onRemoveKind: (k: Kind) => void;
}) {
  if (moods.length === 0 && kinds.length === 0) return null;
  return (
    <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4">
      {kinds.map((k) => (
        <button
          key={`k-${k}`}
          type="button"
          onClick={() => onRemoveKind(k)}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-forest/15 px-2.5 py-1 text-[11px] capitalize text-forest"
        >
          {k} ✕
        </button>
      ))}
      {moods.map((m) => (
        <button
          key={`m-${m}`}
          type="button"
          onClick={() => onRemoveMood(m)}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] capitalize"
        >
          {m} ✕
        </button>
      ))}
    </div>
  );
}
