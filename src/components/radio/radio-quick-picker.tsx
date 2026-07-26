import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Radio as RadioIcon, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { listStations, type StationCard } from "@/lib/radio.functions";
import { startStation } from "@/lib/radio-client";
import { usePlayer } from "@/lib/player-context";
import { useMembership } from "@/hooks/use-membership";
import { useRadioUsage } from "@/hooks/use-radio-usage";
import { UpsellSheet } from "@/components/membership/upsell-sheet";

/**
 * Compact station picker used inside the Solo Walk ready screen and
 * anywhere else a small station list is helpful. Reuses the same
 * entitlement, usage, and player wiring as `RadioRail` — never introduces
 * a second audio element or duplicate accounting.
 */
export function RadioQuickPicker() {
  const fetcher = useServerFn(listStations);
  const [stations, setStations] = useState<StationCard[] | null>(null);
  const player = usePlayer();
  const { isPlus, loading: membershipLoading } = useMembership();
  const { freeSeconds, usedSeconds, loading: usageLoading } = useRadioUsage();
  const [paywallOpen, setPaywallOpen] = useState(false);

  useEffect(() => {
    fetcher()
      .then((s) => setStations(s as StationCard[]))
      .catch(() => setStations([]));
  }, [fetcher]);

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
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 flex-1 animate-pulse rounded-full bg-muted/60" />
        ))}
      </div>
    );
  }
  if (!sorted.length) {
    return <p className="text-xs text-muted-foreground">No stations available.</p>;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {sorted.slice(0, 4).map((s) => (
          <button
            key={s.slug}
            type="button"
            onClick={() => onStart(s.slug, s.title)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-medium hover:bg-accent/40"
          >
            <RadioIcon className="h-3.5 w-3.5 text-forest" />
            {s.title}
          </button>
        ))}
        <button
          type="button"
          onClick={() => player.stop()}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/40"
        >
          <VolumeX className="h-3.5 w-3.5" />
          No audio
        </button>
      </div>
      <UpsellSheet
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        surface="radio"
        title="You've reached the free Radio limit"
        body="Upgrade to Plus for unlimited listening. Your $2.99 keeps the service running."
      />
    </>
  );
}
