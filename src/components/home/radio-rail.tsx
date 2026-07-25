import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Radio } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Shimmer } from "@/components/ui/shimmer";
import { listStations, type StationCard } from "@/lib/radio.functions";
import { startStation } from "@/lib/radio-client";
import { usePlayer } from "@/lib/player-context";
import { toast } from "sonner";

export function RadioRail() {
  const fetcher = useServerFn(listStations);
  const [stations, setStations] = useState<StationCard[] | null>(null);
  const player = usePlayer();

  useEffect(() => {
    fetcher().then((s) => setStations(s as StationCard[])).catch(() => setStations([]));
  }, [fetcher]);

  const onStart = async (slug: string, title: string) => {
    try {
      const ok = await startStation(slug, player);
      if (!ok) toast.error("No tracks in this station yet.");
      else toast.success(`Playing ${title}`);
    } catch {
      toast.error("Couldn't start station.");
    }
  };

  if (stations === null) {
    return (
      <div className="-mx-1 flex gap-3 overflow-hidden px-1 pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} className="h-40 w-40 shrink-0" />
        ))}
      </div>
    );
  }
  if (!stations.length) return null;

  return (
    <section aria-labelledby="radio-heading">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 id="radio-heading" className="flex items-center gap-2 font-serif text-lg text-foreground">
          <Radio className="h-4 w-4 text-forest" />
          MHWC Radio
        </h2>
        <span className="text-[11px] text-muted-foreground">Ambient companions</span>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {stations.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onStart(s.slug, s.title)}
            aria-label={`Play ${s.title}`}
            className="block w-40 shrink-0 text-left"
          >
            <Card className="overflow-hidden rounded-2xl border-border bg-card/90 shadow-soft transition active:scale-[0.98] hover:-translate-y-0.5">
              <div className="aspect-square w-full bg-muted">
                {s.cover_signed ? (
                  <img src={s.cover_signed} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-forest/40">
                    <Radio className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="line-clamp-1 text-sm font-medium text-foreground">{s.title}</p>
                {s.subtitle && <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{s.subtitle}</p>}
              </div>
            </Card>
          </button>
        ))}
      </div>
    </section>
  );
}
