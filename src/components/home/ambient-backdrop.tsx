import { useEffect, useState } from "react";
import { useCurrentWeather, useGeolocation } from "@/hooks/use-weather";

type Phase = "dawn" | "day" | "dusk" | "night";

function phaseForHour(h: number): Phase {
  if (h >= 5 && h < 9) return "dawn";
  if (h >= 9 && h < 17) return "day";
  if (h >= 17 && h < 21) return "dusk";
  return "night";
}

/**
 * Ambient backdrop — fixed behind page content. Weather-tinted with a
 * time-of-day phase warm-shift (dawn/day/dusk/night). CSS-only, GPU-cheap,
 * respects prefers-reduced-motion.
 */
export function AmbientBackdrop() {
  const { coords } = useGeolocation({ autoRequest: false, ipFallback: true });
  const { data } = useCurrentWeather(coords);
  const tone = data?.tone ?? "clear";
  const isDay = data?.isDay ?? true;

  const [phase, setPhase] = useState<Phase>(() => phaseForHour(new Date().getHours()));
  useEffect(() => {
    const id = setInterval(() => setPhase(phaseForHour(new Date().getHours())), 10 * 60_000);
    return () => clearInterval(id);
  }, []);

  // Per-tone color stops, then biased by the time-of-day phase.
  const palettes: Record<string, [string, string, string]> = {
    clear: isDay ? ["#fef6e4", "#fde2c1", "#f7d3a3"] : ["#1c2541", "#2a3559", "#3a4a78"],
    cloud: ["#e8ecef", "#d6dde2", "#c4ccd2"],
    rain:  ["#cbd5e1", "#a5b4c4", "#7e8fa3"],
    drizzle: ["#dde6ec", "#bccbd6", "#9aaebc"],
    snow:  ["#f1f5f9", "#dde7ef", "#cbd9e3"],
    fog:   ["#e5e7eb", "#cfd3d9", "#b8bdc4"],
    storm: ["#3b3f4d", "#2c2f3a", "#1f2129"],
  };
  const [a, b, c] = palettes[tone] ?? palettes.clear;

  // Phase tint overlay — a single warm/cool wash on top of the base palette.
  const phaseWash: Record<Phase, string> = {
    dawn:  "radial-gradient(80% 60% at 15% 10%, rgba(255, 196, 159, 0.28) 0%, transparent 65%)",
    day:   "radial-gradient(90% 60% at 50% 0%, rgba(255, 244, 214, 0.10) 0%, transparent 70%)",
    dusk:  "radial-gradient(80% 60% at 85% 10%, rgba(255, 168, 130, 0.30) 0%, transparent 65%), radial-gradient(70% 50% at 20% 90%, rgba(120, 100, 160, 0.18) 0%, transparent 70%)",
    night: "radial-gradient(100% 70% at 50% 100%, rgba(40, 50, 90, 0.30) 0%, transparent 70%)",
  };

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        background: `radial-gradient(120% 80% at 20% 10%, ${a} 0%, transparent 60%), radial-gradient(120% 80% at 80% 90%, ${c} 0%, transparent 55%), linear-gradient(135deg, ${a} 0%, ${b} 50%, ${c} 100%)`,
        transition: "background 1200ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <div
        className="absolute inset-0"
        style={{ background: phaseWash[phase], transition: "background 1200ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      />
      <div
        className="wp-backdrop-drift absolute inset-0 opacity-60"
        style={{
          background: `radial-gradient(60% 40% at 30% 30%, ${b} 0%, transparent 65%), radial-gradient(50% 35% at 70% 70%, ${a} 0%, transparent 65%)`,
        }}
      />
      {Array.from({ length: 8 }).map((_, i) => (
        <span
          key={i}
          className="wp-dust"
          style={{
            left: `${(i * 13 + 7) % 100}%`,
            top: `${(i * 23 + 17) % 100}%`,
            animationDelay: `${(i * 1.7) % 8}s`,
            animationDuration: `${22 + (i % 5) * 4}s`,
          }}
        />
      ))}
    </div>
  );
}

