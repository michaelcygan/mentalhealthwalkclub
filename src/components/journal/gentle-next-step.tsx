import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Footprints, PenLine, BookHeart } from "lucide-react";
import type { JournalStats } from "@/lib/journal-entries.functions";
import { isoDay } from "@/lib/journal-derive";
import { ReflectionWriteSheet } from "@/components/home/reflection-write-sheet";

interface Props {
  stats: JournalStats;
  onSaved?: () => void;
  onScrollToMemories?: () => void;
}

export function GentleNextStep({ stats, onSaved, onScrollToMemories }: Props) {
  const today = isoDay(new Date());
  const walkedToday = stats.walkDays.includes(today);
  const wroteToday = stats.entryDays.includes(today);
  const [writeOpen, setWriteOpen] = useState(false);

  const variant = useMemo(() => {
    if (!walkedToday) return "walk" as const;
    if (!wroteToday) return "write" as const;
    return "rest" as const;
  }, [walkedToday, wroteToday]);

  if (variant === "walk") {
    return (
      <Link
        to="/walk"
        className="flex items-center justify-between gap-3 rounded-3xl border border-border bg-card p-4 shadow-soft hover:border-forest/40"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">
            <Footprints className="h-4 w-4" />
          </span>
          <div>
            <p className="font-serif text-[15px] text-foreground">Take a 10-minute walk</p>
            <p className="text-[11px] text-muted-foreground">A small loop counts.</p>
          </div>
        </div>
        <span className="text-[11px] uppercase tracking-[0.14em] text-forest">Start →</span>
      </Link>
    );
  }

  if (variant === "write") {
    return (
      <>
        <button
          type="button"
          onClick={() => setWriteOpen(true)}
          className="flex w-full items-center justify-between gap-3 rounded-3xl border border-border bg-card p-4 text-left shadow-soft hover:border-forest/40"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-clay/10 text-clay">
              <PenLine className="h-4 w-4" />
            </span>
            <div>
              <p className="font-serif text-[15px] text-foreground">Write a line about today</p>
              <p className="text-[11px] text-muted-foreground">One sentence is enough.</p>
            </div>
          </div>
          <span className="text-[11px] uppercase tracking-[0.14em] text-clay">Write →</span>
        </button>
        <ReflectionWriteSheet
          open={writeOpen}
          onOpenChange={setWriteOpen}
          prompt={null}
          source="journal_freeform"
          onSaved={() => {
            setWriteOpen(false);
            onSaved?.();
          }}
        />
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={onScrollToMemories}
      className="flex w-full items-center justify-between gap-3 rounded-3xl border border-border bg-card p-4 text-left shadow-soft hover:border-forest/40"
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-forest">
          <BookHeart className="h-4 w-4" />
        </span>
        <div>
          <p className="font-serif text-[15px] text-foreground">Rest counts too</p>
          <p className="text-[11px] text-muted-foreground">Revisit a memory instead.</p>
        </div>
      </div>
      <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Look back →</span>
    </button>
  );
}
