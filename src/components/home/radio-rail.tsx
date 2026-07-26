import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Radio, RotateCcw, Star } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Shimmer } from "@/components/ui/shimmer";
import { listStations, type StationCard } from "@/lib/radio.functions";
import { startStation, getLastStation } from "@/lib/radio-client";
import { usePlayer } from "@/lib/player-context";
import { useMembership } from "@/hooks/use-membership";
import { useRadioUsage } from "@/hooks/use-radio-usage";
import { UpsellSheet } from "@/components/membership/upsell-sheet";
import { toast } from "sonner";
import radioCoverDefault from "@/assets/radio-cover-default.jpg";

export function RadioRail() {
  const fetcher = useServerFn(listStations);
  const [stations, setStations] = useState<StationCard[] | null>(null);
  const [lastSlug, setLastSlug] = useState<string | null>(null);
  const player = usePlayer();
  const { isPlus, loading: membershipLoading } = useMembership();
  const { freeSeconds, usedSeconds, loading: usageLoading } = useRadioUsage();
  const [paywallOpen, setPaywallOpen] = useState(false);

  useEffect(() => {
    fetcher().then((s) => setStations(s as StationCard[])).catch(() => setStations([]));
    setLastSlug(getLastStation());
  }, [fetcher]);

  // Pin default station first, then by sort.
  const sorted = useMemo(() => {
    if (!stations) return null;
    return [...stations].sort((a, b) => {
      if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
      return a.sort - b.sort;
    });
  }, [stations]);

  const onStart = async (slug: string, title: string) => {
    if (membershipLoading || usageLoading) return;
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

  if (sorted === null) {
    return (
      <div className="-mx-1 flex gap-3 overflow-hidden px-1 pb-2 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:px-0 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} className="h-40 w-40 shrink-0 md:h-auto md:w-auto md:aspect-[5/3]" />
        ))}
      </div>
    );
  }
  if (!sorted.length) return null;

  const resumeStation = lastSlug ? sorted.find((s) => s.slug === lastSlug) ?? null : null;

  const freeMinutes = Math.round(freeSeconds / 60);
  const usedMinutes = Math.round(usedSeconds / 60);

  const StationTile = ({ s, variant }: { s: StationCard; variant: "mobile" | "desktop" }) => {
    const cover = s.cover_signed ?? radioCoverDefault;
    if (variant === "mobile") {
      return (
        <button
          type="button"
          onClick={() => onStart(s.slug, s.title)}
          aria-label={`Play ${s.title}`}
          className="block w-44 shrink-0 snap-start text-left"
        >
          <Card className="overflow-hidden rounded-3xl border-border bg-card/90 shadow-soft transition active:scale-[0.98] hover:-translate-y-0.5">
            <div className="relative aspect-square w-full overflow-hidden bg-muted">
              <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              <span className="absolute left-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/85 text-forest backdrop-blur">
                <Radio className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="p-3">
              <p className="line-clamp-1 font-serif text-sm text-foreground">{s.title}</p>
              {s.subtitle && <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{s.subtitle}</p>}
            </div>
          </Card>
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => onStart(s.slug, s.title)}
        aria-label={`Play ${s.title}`}
        className="group block w-full text-left"
      >
        <Card className="overflow-hidden rounded-3xl border-border bg-card/90 shadow-soft transition group-hover:-translate-y-0.5 group-hover:shadow-md">
          <div className="relative aspect-[5/3] w-full overflow-hidden bg-muted">
            <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
            <span className="absolute left-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/85 text-forest backdrop-blur">
              <Radio className="h-4 w-4" />
            </span>
            <div className="absolute inset-x-0 bottom-0 p-4">
              <p className="line-clamp-1 font-serif text-base text-white drop-shadow-sm">{s.title}</p>
              {s.subtitle && <p className="mt-0.5 line-clamp-1 text-xs text-white/80">{s.subtitle}</p>}
            </div>
          </div>
        </Card>
      </button>
    );
  };

  return (
    <section aria-labelledby="radio-heading">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 id="radio-heading" className="flex items-center gap-2 font-serif text-lg text-foreground">
          <Radio className="h-4 w-4 text-forest" />
          Radio
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {isPlus ? "Unlimited" : `${usedMinutes} / ${freeMinutes} min free this month`}
        </span>
      </div>

      {/* Mobile: horizontal snap rail */}
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden">
        {stations.map((s) => (
          <StationTile key={s.id} s={s} variant="mobile" />
        ))}
      </div>

      {/* Desktop: responsive grid */}
      <div className="hidden md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {stations.map((s) => (
          <StationTile key={s.id} s={s} variant="desktop" />
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
