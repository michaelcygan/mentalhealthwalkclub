import { WeatherGlyph } from "@/lib/weather-icons";
import type { WeatherTone } from "@/lib/weather";

interface Props {
  tempF: number;
  label?: string;
  tone: WeatherTone;
  isDay?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/** Compact, glanceable weather chip — safe inside dark or light surfaces. */
export function WeatherPill({ tempF, label, tone, isDay = true, size = "sm", className }: Props) {
  const px = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-foreground/5 ${px} font-medium tracking-tight ${className ?? ""}`}
    >
      <WeatherGlyph tone={tone} isDay={isDay} className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      <span>{Math.round(tempF)}°</span>
      {label && <span className="text-muted-foreground">· {label}</span>}
    </span>
  );
}
