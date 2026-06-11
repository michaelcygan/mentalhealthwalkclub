import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useServerFn } from "@tanstack/react-start";
import { recentPodcastEpisodes, type PodcastEpisodeCard } from "@/lib/podcasts.functions";
import { Headphones } from "lucide-react";
import { CoverThumb } from "@/components/listen/cover-thumb";
import { usePlayOrOpen } from "@/lib/play-helpers";
import { TileActionsMenu } from "@/components/listen/tile-actions";

function formatDuration(s: number): string {
  if (!s) return "";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function PodcastRail() {
  const fetcher = useServerFn(recentPodcastEpisodes);
  const [items, setItems] = useState<PodcastEpisodeCard[] | null>(null);
  const playOrOpen = usePlayOrOpen();

  useEffect(() => {
    fetcher({ data: { limit: 8 } }).then(setItems).catch(() => setItems([]));
  }, [fetcher]);

  if (items === null) return <div className="h-44 animate-pulse rounded-2xl bg-muted/40" />;
  if (!items.length) return null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 font-serif text-lg text-foreground">
          <Headphones className="h-4 w-4 text-forest" /> Listen
        </h2>
        <Link to="/listen" className="text-xs text-muted-foreground hover:text-foreground">All →</Link>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((ep) => (
          <button
            key={ep.id}
            type="button"
            onClick={() => playOrOpen({
              kind: "podcast", id: ep.id, title: ep.title, subtitle: ep.publisher,
              cover: ep.image_url, audio_url: ep.audio_url, link: ep.episode_url,
              duration_seconds: ep.duration_seconds,
            })}
            aria-label={`Play ${ep.title}`}
            className="block w-44 shrink-0 text-left"
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
          </button>
        ))}
      </div>
    </section>
  );
}
