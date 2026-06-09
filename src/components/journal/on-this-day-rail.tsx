import { useMemo } from "react";
import { Calendar, Footprints, PenLine } from "lucide-react";
import type { FeedEntry } from "@/lib/journal-entries.functions";

interface Props {
  entries: FeedEntry[];
}

function sameMonthDay(a: Date, b: Date) {
  return a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function yearsAgo(then: Date, now: Date) {
  const years = now.getFullYear() - then.getFullYear();
  if (years <= 0) {
    const months = (now.getFullYear() - then.getFullYear()) * 12 + now.getMonth() - then.getMonth();
    if (months >= 1) return `${months} month${months === 1 ? "" : "s"} ago`;
    const days = Math.round((now.getTime() - then.getTime()) / 86400000);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

export function OnThisDayRail({ entries }: Props) {
  const items = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return entries
      .map((e) => ({ e, d: new Date(e.at) }))
      .filter(({ d }) => {
        const diffDays = Math.round((now.getTime() - d.getTime()) / 86400000);
        if (diffDays < 7) return false;
        return sameMonthDay(d, now) || diffDays === 30 || diffDays === 90 || diffDays === 365;
      })
      .slice(0, 8);
  }, [entries]);

  if (items.length === 0) return null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          On this day
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Calendar className="h-3 w-3" /> Memories
        </span>
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(({ e, d }) => {
          const now = new Date();
          const label = yearsAgo(d, now);
          const snippet =
            e.kind === "reflection"
              ? (e.body ?? "").trim()
              : (e.reflection_note ?? "").trim() ||
                (e.mood_after ? `Mood after: ${e.mood_after}` : "A walk worth remembering.");
          return (
            <article
              key={`${e.kind}-${e.id}`}
              className="w-[78%] shrink-0 snap-start rounded-2xl border border-border bg-card p-3 shadow-soft"
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {e.kind === "reflection" ? (
                  <PenLine className="h-3 w-3" />
                ) : (
                  <Footprints className="h-3 w-3" />
                )}
                <span>{label}</span>
                <span className="text-muted-foreground/70">·</span>
                <span>{d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              </div>
              {e.prompt_text && (
                <p className="mt-1.5 line-clamp-1 font-serif text-xs italic text-muted-foreground">
                  {e.prompt_text}
                </p>
              )}
              <p className="mt-1 line-clamp-3 font-serif text-sm leading-snug text-foreground">
                {snippet || "—"}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
