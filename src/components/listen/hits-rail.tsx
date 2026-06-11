import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Headphones, Waves, Music, BookOpen } from "lucide-react";
import { trendingListen, recentlyAddedListen, type SearchHit, type SearchKind } from "@/lib/listen-search.functions";
import { CoverThumb } from "@/components/listen/cover-thumb";
import { usePlayOrOpen } from "@/lib/play-helpers";
import { TileActionsMenu } from "@/components/listen/tile-actions";

const KIND_ICON: Record<SearchKind, typeof Headphones> = {
  podcast: Headphones, ambient: Waves, guided: Music, blog: BookOpen,
};

function fmt(s: number | null | undefined) { return s ? `${Math.round(s / 60)} min` : ""; }

export function HitsRail({ mode }: { mode: "trending" | "recent" }) {
  const [items, setItems] = useState<SearchHit[] | null>(null);
  const fetchTrending = useServerFn(trendingListen);
  const fetchRecent = useServerFn(recentlyAddedListen);
  const playOrOpen = usePlayOrOpen();
  useEffect(() => {
    const fn = mode === "trending"
      ? fetchTrending({ data: { days: 7, limit: 8 } })
      : fetchRecent({ data: { days: 14, limit: 8 } });
    fn.then(setItems).catch(() => setItems([]));
  }, [mode, fetchTrending, fetchRecent]);

  if (items === null) {
    return (
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 w-36 shrink-0 animate-pulse rounded-2xl bg-card" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-border bg-card/60 p-4 text-center text-[11px] text-muted-foreground">
        {mode === "trending" ? "Quiet week — be the first to play something." : "Nothing new in the last two weeks."}
      </p>
    );
  }
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
      {items.map((h) => {
        const Icon = KIND_ICON[h.kind];
        return (
          <div
            key={`${h.kind}-${h.id}`}
            role="button"
            tabIndex={0}
            onClick={() => playOrOpen(h)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); playOrOpen(h); } }}
            aria-label={`Play ${h.title}`}
            className="group relative w-36 shrink-0 snap-start rounded-2xl border border-border bg-card p-2 text-left shadow-soft transition active:scale-[0.98] hover:-translate-y-0.5"
          >
            <div className="mb-2 aspect-square overflow-hidden rounded-xl">
              <CoverThumb src={h.cover} title={h.title} kind={h.kind} />
            </div>
            {h.kind !== "ambient" && (
              <div className="absolute right-3 top-3">
                <TileActionsMenu item={h} />
              </div>
            )}
            <p className="line-clamp-2 font-serif text-xs leading-tight">{h.title}</p>
            <p className="truncate text-[10px] text-muted-foreground">
              <Icon className="mr-1 inline h-2.5 w-2.5" />
              {h.subtitle ?? ""}{h.duration_seconds ? ` · ${fmt(h.duration_seconds)}` : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}
