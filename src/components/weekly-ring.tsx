export function WeeklyRing({ minutes, goal = 90, size = 96, dots }: { minutes: number; goal?: number; size?: number; dots?: boolean[] }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, minutes / goal);
  const offset = c * (1 - pct);
  return (
    <div className="flex items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--secondary))" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            stroke="var(--forest)" strokeWidth={stroke} fill="none" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 600ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-xl tabular-nums leading-none">{minutes}</span>
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">/{goal} min</span>
        </div>
      </div>
      <div>
        <div className="text-sm font-medium">This week</div>
        <p className="text-xs text-muted-foreground">Small walks count.</p>
        {dots && (
          <div className="mt-2 flex gap-1.5">
            {dots.map((on, i) => (
              <span key={i} className={`h-2 w-2 rounded-full ${on ? "bg-forest" : "bg-secondary"}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
