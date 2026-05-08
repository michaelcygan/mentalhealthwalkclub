import { useEffect, useState } from "react";
import { useMinutelyRain } from "@/hooks/use-weather";
import { nextRainMinutes } from "@/lib/weather";
import { WeatherGlyph } from "@/lib/weather-icons";
import { X } from "lucide-react";
import { haptics } from "@/lib/device";

interface Props {
  coords: { lat: number; lng: number } | null;
  active: boolean;
  /** True if the walker is currently in rain (precipitation > 0 right now). */
  currentlyRaining?: boolean;
}

/**
 * Soft, one-shot rain heads-up. Only fires once per mount.
 * Tone is gentle ("Loop back?"), never alarming.
 */
export function RainSoonBanner({ coords, active, currentlyRaining }: Props) {
  const minutely = useMinutelyRain(coords, active);
  const [dismissed, setDismissed] = useState(false);
  const [shown, setShown] = useState(false);
  const inMins = nextRainMinutes(minutely);
  const trigger = !dismissed && active && !currentlyRaining && inMins !== null && inMins > 0 && inMins <= 20;

  useEffect(() => {
    if (trigger && !shown) {
      setShown(true);
      haptics.soft();
    }
  }, [trigger, shown]);

  if (currentlyRaining && active && !dismissed) {
    return (
      <div className="mx-1 my-2 flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-100">
        <WeatherGlyph tone="rain" className="h-4 w-4" />
        <span>Walking in the rain — proud of you.</span>
        <button onClick={() => setDismissed(true)} aria-label="dismiss" className="ml-auto opacity-60 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (!trigger) return null;
  return (
    <div className="mx-1 my-2 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
      <WeatherGlyph tone="drizzle" className="h-4 w-4" />
      <span>Rain likely in ~{inMins} min. Loop back?</span>
      <button onClick={() => setDismissed(true)} aria-label="dismiss" className="ml-auto opacity-60 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
