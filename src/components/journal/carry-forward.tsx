import { useMemo, useState } from "react";
import { Quote } from "lucide-react";
import type { FeedEntry } from "@/lib/journal-entries.functions";
import { pickCarryForward } from "@/lib/journal-derive";
import { ReflectionWriteSheet } from "@/components/home/reflection-write-sheet";

interface Props {
  entries: FeedEntry[];
  onSaved?: () => void;
}

function relativeDate(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const days = Math.round((now.getTime() - then.getTime()) / 86400000);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

export function CarryForward({ entries, onSaved }: Props) {
  const quote = useMemo(() => pickCarryForward(entries), [entries]);
  const [open, setOpen] = useState(false);

  if (!quote) return null;

  return (
    <>
      <section className="rounded-3xl border border-border bg-card p-4 shadow-soft">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Carry forward
          </div>
          <span className="text-[11px] text-muted-foreground">{relativeDate(quote.at)}</span>
        </div>
        <div className="mt-2 flex gap-3">
          <Quote className="mt-0.5 h-4 w-4 shrink-0 text-clay/70" />
          <p className="font-serif text-[15px] italic leading-snug text-foreground">
            {quote.text}
          </p>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">From your journal</span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full bg-forest px-3 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-95"
          >
            Reflect on this
          </button>
        </div>
      </section>
      <ReflectionWriteSheet
        open={open}
        onOpenChange={setOpen}
        prompt={{ id: quote.id, text: quote.text }}
        source="journal_freeform"
        onSaved={() => {
          setOpen(false);
          onSaved?.();
        }}
      />
    </>
  );
}
