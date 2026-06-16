import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Shimmer } from "@/components/ui/shimmer";
import { useServerFn } from "@tanstack/react-start";
import { recentPodcastEpisodes, type PodcastEpisodeCard } from "@/lib/podcasts.functions";
import { Headphones, X } from "lucide-react";
import { CoverThumb } from "@/components/listen/cover-thumb";
import { usePlayOrOpen } from "@/lib/play-helpers";
import { TileActionsMenu } from "@/components/listen/tile-actions";
import type { SelectedShow } from "@/components/home/listen-and-read";

function formatDuration(s: number): string {
  if (!s) return "";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

interface Props {
  selected?: SelectedShow | null;
  onClear?: () => void;
}

export function PodcastRail({ selected = null, onClear }: Props) {
  const fetcher = useServerFn(recentPodcastEpisodes);
  const [items, setItems] = useState<PodcastEpisodeCard[] | null>(null);
  const playOrOpen = usePlayOrOpen();
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setItems(null);
    const limit = selected ? 12 : 8;
    fetcher({ data: selected ? { limit, feedId: selected.feedId } : { limit } })
      .then(setItems)
      .catch(() => setItems([]));
  }, [fetcher, selected]);

  useEffect(() => {
    if (selected && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selected]);

  if (items === null) return (
    <div className="-mx-1 flex gap-3 overflow-hidden px-1 pb-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Shimmer key={i} className="h-44 w-44 shrink-0" />
      ))}
    </div>
  );
  if (!items.length && !selected) return null;

  return (
    <section ref={sectionRef}>
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h2 className="flex min-w-0 items-center gap-2 font-serif text-lg text-foreground">
          <Headphones className="h-4 w-4 shrink-0 text-forest" />
          <span className="truncate">{selected ? selected.title : "Listen"}</span>
        </h2>
        {selected ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-1 text-[11px] font-medium text-foreground transition hover:bg-secondary/80"
          >
            <X className="h-3 w-3" /> All shows
          </button>
        ) : (
          <Link to="/listen" className="text-xs text-muted-foreground hover:text-foreground">All →</Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="px-1 pb-2 text-xs text-muted-foreground">No episodes for this show yet.</p>
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((ep) => {
            const item = {
              kind: "podcast" as const, id: ep.id, title: ep.title, subtitle: ep.publisher,
              cover: ep.image_url, audio_url: ep.audio_url, link: ep.episode_url,
              duration_seconds: ep.duration_seconds,
            };
            return (
              <div
                key={ep.id}
                role="button"
                tabIndex={0}
                onClick={() => playOrOpen(item)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); playOrOpen(item); } }}
                aria-label={`Play ${ep.title}`}
                className="relative block w-44 shrink-0 text-left"
              >
                <Card className="overflow-hidden rounded-2xl border-border bg-card/90 shadow-soft backdrop-blur-sm transition active:scale-[0.98] hover:-translate-y-0.5">
                  <div className="aspect-square w-full">
                    <CoverThumb src={ep.image_url} title={ep.title} kind="podcast" />
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{ep.title}</p>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      {ep.publisher ?? "Podcast"}{ep.duration_seconds ? ` · ${formatDuration(ep.duration_seconds)}` : ""}
                    </p>
                  </div>
                </Card>
                <div className="absolute right-2 top-2">
                  <TileActionsMenu item={item} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
