import { useEffect, useState } from "react";
import { AmbientVideoBanner, type AmbientClip } from "@/components/ambient-video-banner";

/** Time-of-day ambient gradient (kept for non-video surfaces / fallback paint). */
export function useHeroGradient() {
  const [hour, setHour] = useState<number>(() => new Date().getHours());
  useEffect(() => {
    const t = setInterval(() => setHour(new Date().getHours()), 15 * 60_000);
    return () => clearInterval(t);
  }, []);
  return hour < 5 ? "from-slate-700/90 via-forest/60 to-forest"
    : hour < 9 ? "from-amber-200/70 via-rose-200/40 to-cream"
    : hour < 17 ? "from-sage/60 via-cream to-cream"
    : hour < 20 ? "from-clay/60 via-amber-200/40 to-cream"
    : "from-indigo-300/40 via-forest/40 to-forest/60";
}

interface Props {
  className?: string;
  children?: React.ReactNode;
  clip?: AmbientClip;
  scrim?: "soft" | "medium" | "strong";
}

/** Hero surface — now an ambient looping video banner with built-in scrim. */
export function HeroGradient({ className = "", children, clip, scrim }: Props) {
  return (
    <AmbientVideoBanner clip={clip} scrim={scrim} className={`rounded-3xl shadow-soft ${className}`}>
      {children}
    </AmbientVideoBanner>
  );
}
