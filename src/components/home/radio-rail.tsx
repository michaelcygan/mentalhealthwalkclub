import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Radio } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Shimmer } from "@/components/ui/shimmer";
import { listStations, type StationCard } from "@/lib/radio.functions";
import { startStation } from "@/lib/radio-client";
import { usePlayer } from "@/lib/player-context";
import { useMembership } from "@/hooks/use-membership";
import { useRadioUsage } from "@/hooks/use-radio-usage";
import { UpsellSheet } from "@/components/membership/upsell-sheet";
import { toast } from "sonner";

export function RadioRail() {
  const fetcher = useServerFn(listStations);
  const [stations, setStations] = useState<StationCard[] | null>(null);
  const player = usePlayer();
  const { isPlus, loading: membershipLoading } = useMembership();
  const { freeSeconds, usedSeconds, loading: usageLoading } = useRadioUsage();
  const [paywallOpen, setPaywallOpen] = useState(false);

  useEffect(() => {
    fetcher().then((s) => setStations(s as StationCard[])).catch(() => setStations([]));
  }, [fetcher]);

  const onStart = async (slug: string, title: string) => {
    if (membershipLoading || usageLoading) return;
    // Anonymous users can preview radio without a cap for now.
    if (!isPlus && usedSeconds >= freeSeconds && freeSeconds > 0) {
      setPaywallOpen(true);
      return;
    }
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

  const freeMinutes = Math.round(freeSeconds / 60);
  const usedMinutes = Math.round(usedSeconds / 60);

  return (
    <section aria-labelledby="radio-heading">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 id="radio-heading" className="flex items-center gap-2 font-serif text-lg text-foreground">
          <Radio className="h-4 w-4 text-forest" />
          MHWC Radio
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {isPlus ? "Unlimited" : `${usedMinutes} / ${freeMinutes} min free this month`}
        </span>
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

      <UpsellSheet
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        surface="radio"
        title="Radio free limit reached"
        body="You've used your free radio minutes this month. Upgrade to Walk Club Plus for unlimited ambient stations."
        cap={freeMinutes}
      />
    </section>
  );
}
