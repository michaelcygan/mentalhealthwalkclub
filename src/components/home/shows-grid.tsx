import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Headphones } from "lucide-react";
import { Shimmer } from "@/components/ui/shimmer";
import { listPodcastShows, type PodcastShowCard } from "@/lib/podcasts.functions";

export function ShowsGrid() {
  const fetcher = useServerFn(listPodcastShows);
  const [items, setItems] = useState<PodcastShowCard[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetcher().then(setItems).catch(() => setItems([]));
  }, [fetcher]);

  if (items === null) {
    return (
      <div className="mt-3 grid grid-cols-3 gap-3 px-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Shimmer key={i} className="aspect-square w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (!items.length) return null;

  return (
    <section className="mt-4">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Headphones className="h-3.5 w-3.5 text-forest" /> Shows
        </h3>
        <Link to="/listen" className="text-xs text-muted-foreground hover:text-foreground">
          All →
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-3 px-1">
        {items.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() =>
              navigate({
                to: "/listen",
                search: { tab: "listen" as const, q: s.title, moods: "", kinds: "" },
              })
            }
            className="group text-left"
          >
            <div className="aspect-square overflow-hidden rounded-xl border border-border bg-muted shadow-soft transition group-active:scale-[0.98]">
              {s.image_url ? (
                <img
                  src={s.image_url}
                  alt={s.title}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-forest/40">
                  <Headphones className="h-6 w-6" />
                </div>
              )}
            </div>
            <p className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-tight text-foreground">
              {s.title}
            </p>
            {s.publisher && (
              <p className="truncate text-[10px] text-muted-foreground">{s.publisher}</p>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
