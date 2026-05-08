import { useState } from "react";
import { LiveNowStrip } from "@/components/live-now-strip";
import { UpcomingFriendWalks } from "@/components/friend-walk/upcoming-friend-walks";
import { WeatherPill } from "@/components/weather-pill";
import { WeatherStrip } from "@/components/weather-strip";
import { useCurrentWeather, useGeolocation, useHourlyForecast } from "@/hooks/use-weather";

/**
 * Composes the user's own upcoming Friend Walks above the public Live Now
 * strip into a single visual block — fewer headings, calmer rhythm.
 * Both children gracefully render nothing when empty.
 *
 * Adds a quiet weather pill on top — opt-in: only renders once we have
 * cached coords (we do not prompt for geolocation from the home page).
 */
export function NowAndNext() {
  return (
    <div className="space-y-4">
      <WeatherInline />
      <UpcomingFriendWalks />
      <LiveNowStrip />
    </div>
  );
}

function WeatherInline() {
  const { coords, requestPrecise } = useGeolocation({ autoRequest: false, ipFallback: true });
  const { data: now } = useCurrentWeather(coords);
  const hours = useHourlyForecast(coords, 6);
  const [open, setOpen] = useState(false);
  if (!now) {
    return (
      <button
        type="button"
        onClick={() => requestPrecise()}
        className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
      >
        Show local weather
      </button>
    );
  }
  const hint = friendlyHint(now.tone, now.tempF);
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        <WeatherPill tempF={now.tempF} label={now.label} tone={now.tone} isDay={now.isDay} />
        {hint && <span className="hidden sm:inline">{hint}</span>}
      </button>
      {open && hours.length > 0 && <WeatherStrip hours={hours} />}
    </div>
  );
}

function friendlyHint(tone: string, tempF: number): string | null {
  if (tone === "rain" || tone === "drizzle") return "a little wet — pack a hood?";
  if (tone === "storm") return "thunder around — maybe an indoor walk.";
  if (tone === "snow") return "snowy out — boots if you've got them.";
  if (tempF <= 32) return "cold out — bundle up.";
  if (tempF >= 88) return "warm — bring water.";
  if (tone === "clear" && tempF >= 55 && tempF <= 78) return "good walking weather.";
  return null;
}
