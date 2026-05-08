import { useEffect, useState } from "react";

/** Time-of-day ambient gradient. Re-evaluates every 15 min so it can drift across a long session. */
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
}

/** Single gradient surface used by home hero, profile header, and active walk hero. */
export function HeroGradient({ className = "", children }: Props) {
  const grad = useHeroGradient();
  return (
    <header className={`overflow-hidden rounded-3xl bg-gradient-to-br ${grad} shadow-soft ${className}`}>
      {children}
    </header>
  );
}
