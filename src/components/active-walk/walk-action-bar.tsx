/**
 * Sticky action bar for the active walk. Always above the OS safe area.
 * The MobileTabBar auto-hides on /walk/active/*, so this owns the bottom.
 */
import { useRef, useState } from "react";
import { Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptics } from "@/lib/device";
import { toast } from "sonner";

interface Props {
  paused: boolean;
  onTogglePause: () => void;
  onEnd: () => void;
}

export function WalkActionBar({ paused, onTogglePause, onEnd }: Props) {
  return (
    <div className="sticky bottom-0 left-0 right-0 z-20 mt-5 bg-background px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 md:static md:mt-6 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-6 left-0 right-0 h-6 bg-gradient-to-b from-transparent to-background md:hidden"
      />
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onTogglePause}
          className="h-14 flex-1 rounded-2xl touch-manipulation md:h-12"
        >
          {paused ? (
            <>
              <Play className="mr-2 h-4 w-4" />
              Resume
            </>
          ) : (
            <>
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </>
          )}
        </Button>
        <LongPressEndButton onEnd={onEnd} />
      </div>
    </div>
  );
}

function LongPressEndButton({ onEnd }: { onEnd: () => void }) {
  const [progress, setProgress] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef<number>(0);
  const fired = useRef(false);
  const HOLD = 700;

  const begin = () => {
    fired.current = false;
    start.current = performance.now();
    haptics.tap();
    const tick = () => {
      const p = Math.min(1, (performance.now() - start.current) / HOLD);
      setProgress(p);
      if (p >= 1 && !fired.current) {
        fired.current = true;
        haptics.success();
        onEnd();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  const cancel = () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    // Only nudge if they held meaningfully (>25%) but let go early.
    // Short, unique id so it never stacks or lingers and blocks the button.
    if (!fired.current && progress > 0.25 && progress < 1) {
      toast("Keep holding to end", { id: "hold-to-end", duration: 1400, dismissible: true });
    }
    setProgress(0);
  };

  return (
    <button
      type="button"
      onPointerDown={begin}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      className="relative h-14 flex-1 overflow-hidden rounded-2xl bg-clay text-primary-foreground touch-manipulation md:h-12"
      aria-label="Hold to end walk"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-primary-foreground/20 transition-[width] duration-75"
        style={{ width: `${progress * 100}%` }}
      />
      <span className="relative flex flex-col items-center justify-center leading-tight">
        <span className="flex items-center text-sm font-medium">
          <Square className="mr-2 h-4 w-4" />
          {progress > 0 ? "Hold…" : "End walk"}
        </span>
        <span className="text-[9px] uppercase tracking-[0.18em] opacity-70">hold to confirm</span>
      </span>
    </button>
  );
}
