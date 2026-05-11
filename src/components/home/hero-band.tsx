import { Link } from "@tanstack/react-router";
import { HeroGradient } from "@/components/hero-gradient";
import type { WalkerLevel } from "@/lib/walker-level";
import { haptics } from "@/lib/device";

interface Props {
  greeting: string;
  name: string;
  microState: string;
  level: WalkerLevel | null;
  initials: string;
}

/**
 * Greeting + small level ring. Tap ring → /profile.
 * Level is hidden on first install so the page feels welcoming, not gamified.
 */
export function HeroBand({ greeting, name, microState, level, initials }: Props) {
  return (
    <HeroGradient className="relative p-6 md:p-8 min-h-[180px] md:min-h-[220px]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.45)]">
          <p className="font-serif text-xs italic text-white/85">Come as you are. Walk at your pace.</p>
          <h1 className="mt-1 font-serif text-2xl leading-tight text-balance md:text-3xl">
            {greeting}{name ? `, ${name}` : ""}.
          </h1>
          <p className="mt-2 max-w-md font-serif text-sm italic text-white/85 text-pretty">{microState}</p>
        </div>
        {level && level.level >= 1 && (
          <Link
            to="/profile"
            onClick={() => haptics.tap()}
            aria-label={`Level ${level.level} · ${level.label}`}
            className="group relative shrink-0 select-none"
          >
            <LevelRing pct={level.pct} initials={initials} />
            <div className="mt-1 text-center text-[9px] font-medium uppercase tracking-[0.16em] text-foreground/70">
              Lv {level.level}
            </div>
          </Link>
        )}
      </div>
    </HeroGradient>
  );
}

function LevelRing({ pct, initials }: { pct: number; initials: string }) {
  const size = 46;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--secondary))" strokeWidth={stroke} fill="none" opacity={0.5} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="var(--forest)" strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms ease" }}
        />
      </svg>
      <div className="absolute inset-1 flex items-center justify-center rounded-full bg-forest font-serif text-xs font-medium text-primary-foreground">
        {initials}
      </div>
    </div>
  );
}
