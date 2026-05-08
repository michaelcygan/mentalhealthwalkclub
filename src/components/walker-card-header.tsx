import { useEffect, useRef } from "react";
import { Share2 } from "lucide-react";
import type { WalkerLevel } from "@/lib/walker-level";
import { haptics, share } from "@/lib/device";

interface Props {
  initials: string;
  displayName: string;
  city: string | null;
  totalWalks: number;
  totalMinutes: number;
  level: WalkerLevel;
  onAvatarLongPress?: () => void;
}

const LEVEL_KEY = "mhwc:lastLevel";

/**
 * Living identity card — avatar with progress ring, level label, share.
 * Long-press avatar → edit; level-up haptic on bump.
 */
export function WalkerCardHeader({ initials, displayName, city, totalWalks, totalMinutes, level, onAvatarLongPress }: Props) {
  const pressTimer = useRef<number | null>(null);
  const size = 88;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - level.pct);

  // Detect level-up across sessions for celebratory haptic
  useEffect(() => {
    try {
      const last = Number(localStorage.getItem(LEVEL_KEY) ?? "-1");
      if (level.level > last) {
        if (last >= 0) haptics.success();
        localStorage.setItem(LEVEL_KEY, String(level.level));
      }
    } catch { /* noop */ }
  }, [level.level]);

  const onPressStart = () => {
    if (!onAvatarLongPress) return;
    pressTimer.current = window.setTimeout(() => { haptics.tap(); onAvatarLongPress(); }, 450);
  };
  const onPressEnd = () => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } };

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const summary = totalWalks > 0
    ? `${totalWalks} walk${totalWalks === 1 ? "" : "s"} · ${hours > 0 ? `${hours}h ` : ""}${mins}m`
    : "Your first walk awaits";

  const onShare = async () => {
    haptics.tap();
    await share({
      title: `${displayName} on Walk Club`,
      text: `${level.label} · ${summary}`,
      url: typeof window !== "undefined" ? window.location.origin : undefined,
    });
  };

  return (
    <header className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-accent/40 via-card to-card p-5 shadow-soft">
      <div className="flex items-center gap-4">
        <div
          className="relative shrink-0 select-none"
          style={{ width: size, height: size }}
          onPointerDown={onPressStart}
          onPointerUp={onPressEnd}
          onPointerLeave={onPressEnd}
          onPointerCancel={onPressEnd}
        >
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--secondary))" strokeWidth={stroke} fill="none" />
            <circle
              cx={size / 2} cy={size / 2} r={r}
              stroke="var(--forest)" strokeWidth={stroke} fill="none" strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 900ms ease" }}
            />
          </svg>
          <div className="absolute inset-1 flex items-center justify-center rounded-full bg-forest font-serif text-2xl text-primary-foreground shadow-soft">
            {initials}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h1 className="truncate font-serif text-2xl leading-tight">{displayName}</h1>
            <button
              onClick={onShare}
              aria-label="Share"
              className="rounded-full p-2 text-muted-foreground transition active:scale-90 hover:bg-accent/40 hover:text-foreground"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
          <p className="truncate text-xs text-muted-foreground">{city || "Add your city"}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-forest">Lv {level.level}</span>
            <span className="font-serif text-sm italic text-foreground/85">{level.label}</span>
          </div>
          <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
            {summary}{level.toNext > 0 ? ` · ${level.toNext}m to next` : ""}
          </p>
        </div>
      </div>
    </header>
  );
}
