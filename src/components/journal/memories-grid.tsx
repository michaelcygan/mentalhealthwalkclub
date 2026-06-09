import { useMemo } from "react";
import { Camera } from "lucide-react";
import type { FeedEntry } from "@/lib/journal-entries.functions";

export function MemoriesGrid({ entries }: { entries: FeedEntry[] }) {
  const photos = useMemo(() => {
    const out: { url: string; at: string; entryId: string }[] = [];
    for (const e of entries) {
      if (e.kind !== "walk") continue;
      for (const url of e.photo_urls ?? []) {
        out.push({ url, at: e.at, entryId: e.id });
      }
    }
    return out;
  }, [entries]);

  if (photos.length === 0) {
    return (
      <div className="space-y-2 rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
        <Camera className="mx-auto h-5 w-5 text-muted-foreground" />
        <h3 className="font-serif text-lg text-foreground">No photos yet</h3>
        <p className="mx-auto max-w-xs text-xs text-muted-foreground">
          Photos from your walks will collect here — a quiet album over time.
        </p>
      </div>
    );
  }

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Photo memories
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {photos.length} photo{photos.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-0.5">
        {photos.map((p, i) => (
          <div key={`${p.entryId}-${i}`} className="relative aspect-square overflow-hidden bg-foreground/5">
            <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-1.5">
              <div className="text-[9px] font-medium uppercase tracking-wider text-cream/90">
                {new Date(p.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
