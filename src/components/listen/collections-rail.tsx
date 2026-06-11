import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { listCollections, type CollectionCard } from "@/lib/collections.functions";
import { CoverThumb } from "@/components/listen/cover-thumb";

export function CollectionsRail() {
  const [items, setItems] = useState<CollectionCard[] | null>(null);
  const fetchCollections = useServerFn(listCollections);
  useEffect(() => {
    fetchCollections({ data: { include_drafts: false } })
      .then(setItems)
      .catch(() => setItems([]));
  }, [fetchCollections]);

  if (items === null) {
    return (
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 w-56 shrink-0 animate-pulse rounded-2xl bg-card" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-border bg-card/60 p-5 text-center text-xs text-muted-foreground">
        New curated bundles coming soon.
      </p>
    );
  }
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
      {items.map((c) => (
        <Link
          key={c.id}
          to="/listen/collection/$slug"
          params={{ slug: c.slug }}
          className="relative flex h-32 w-56 shrink-0 snap-start flex-col justify-end overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-forest/20 via-card to-card p-3 shadow-soft"
        >
          <div className="absolute inset-0 opacity-70">
            <CoverThumb src={c.cover_url} title={c.name} kind="collection" />
          </div>
          <div className="relative">
            <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-forest backdrop-blur">
              <Sparkles className="h-2.5 w-2.5" /> Collection
            </div>
            <p className="line-clamp-1 font-serif text-sm leading-tight">{c.name}</p>
            <p className="text-[10px] text-muted-foreground">{c.item_count} {c.item_count === 1 ? "item" : "items"}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
