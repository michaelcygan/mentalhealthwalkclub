import { useEffect, useState } from "react";

interface Props {
  startSeconds: number;
  onZero?: () => void;
  paused?: boolean;
}

export function TimerRing({ startSeconds, onZero, paused }: Props) {
  const [remaining, setRemaining] = useState(startSeconds);

  useEffect(() => {
    setRemaining(startSeconds);
  }, [startSeconds]);

  useEffect(() => {
    if (paused) return;
    if (remaining <= 0) return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t);
          onZero?.();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [paused, remaining, onZero]);

  const pct = Math.max(0, Math.min(1, remaining / startSeconds));
  const r = 54;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  const min = Math.floor(remaining / 60);
  const sec = String(remaining % 60).padStart(2, "0");
  const done = remaining <= 0;

  return (
    <div className="relative grid h-32 w-32 place-items-center">
      <svg width="128" height="128" className="-rotate-90">
        <circle cx="64" cy="64" r={r} stroke="hsl(var(--border))" strokeWidth="8" fill="none" />
        <circle
          cx="64"
          cy="64"
          r={r}
          stroke={done ? "hsl(var(--clay, 30 60% 55%))" : "hsl(var(--forest, 150 30% 30%))"}
          strokeWidth="8"
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-serif text-2xl tabular-nums">
          {min}:{sec}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {done ? "wrap up" : "remaining"}
        </div>
      </div>
    </div>
  );
}
