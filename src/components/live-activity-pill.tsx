import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Radio, Users, Footprints, ChevronUp, Square, Play, Pause, Volume2, VolumeX, Headphones } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { haptics } from "@/lib/device";
import { useWalkRuntime } from "@/lib/walk-runtime";

const COLLAPSE_KEY = "live-activity-pill:collapsed";

/**
 * Bottom-anchored "Dynamic Island" for the active walk. Mounted once at the
 * root. Sits above the MobileTabBar (never under it). Hidden on
 * /walk/active/* and /journal.
 *
 * All state comes from `useWalkRuntime`, which is the global source of truth
 * (see src/lib/walk-runtime.tsx). The pill renders pause/mute/end inline and
 * those actions take effect even on routes where the active-walk page is
 * unmounted, because the runtime owns the audio element and the paused flag.
 */
export function LiveActivityPill() {
  const { user } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const {
    active,
    paused,
    togglePause,
    hasInlineAudio,
    podcast,
    audioMuted,
    toggleAudioMute,
    endActiveWalk,
  } = useWalkRuntime();

  const [elapsed, setElapsed] = useState("0:00");
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(COLLAPSE_KEY) === "1";
  });

  // Tick elapsed (freezes when paused, like the active-walk page)
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const s = Math.max(0, Math.floor((Date.now() - active.startedAt) / 1000));
      const m = Math.floor(s / 60),
        sec = s % 60;
      setElapsed(`${m}:${sec.toString().padStart(2, "0")}`);
    };
    tick();
    if (paused) return;
    const i = window.setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [active, paused]);

  // Swipe to collapse/expand
  const touchStartY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    if (dy < -24) setAndPersist(true);
    else if (dy > 24) setAndPersist(false);
    touchStartY.current = null;
  };
  const setAndPersist = (v: boolean) => {
    setCollapsed(v);
    try {
      sessionStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
    } catch {
      /* noop */
    }
  };

  const onActiveWalkRoute = path.startsWith("/walk/active/");
  const onJournal = path.startsWith("/journal");
  if (!active || !user || onActiveWalkRoute || onJournal) return null;

  const goReturn = () => {
    haptics.tap();
    if (collapsed) {
      setAndPersist(false);
      return;
    }
    navigate({ to: "/walk/active/$id" as never, params: { id: active.walkId } as never });
  };

  const handleEnd = () => {
    haptics.tap();
    // Navigate to active-walk so the user lands in the EndWalkFlow (with
    // distance/steps/reflection). The runtime's endActiveWalk is reserved for
    // hard cancellations from the pill on routes where we can't open that flow.
    navigate({
      to: "/walk/active/$id" as never,
      params: { id: active.walkId } as never,
      search: { end: 1 } as never,
    });
  };

  const handleHardEnd = () => {
    haptics.tap();
    void endActiveWalk();
  };

  const handlePauseTap = () => {
    haptics.tap();
    togglePause();
  };

  const handleMuteTap = () => {
    haptics.tap();
    toggleAudioMute();
  };

  const inPod = active.roomTitle !== null;
  // Title shown on the pill: podcast > pod title > generic
  const title = podcast?.title ?? active.roomTitle ?? "walk in progress";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3 md:left-60 md:px-6"
      style={{
        bottom: "calc(var(--tabbar-h, 0px) + env(safe-area-inset-bottom) + 10px)",
      }}
    >
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={`pointer-events-auto w-full max-w-md overflow-hidden rounded-3xl border border-forest/40 bg-forest/95 text-cream shadow-elevated backdrop-blur-md transition-all duration-300 ease-out ${
          collapsed ? "max-h-12" : "max-h-48"
        }`}
        style={{ animation: "live-pill-in 360ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={goReturn}
            aria-label="Expand active walk"
            className="flex w-full items-center justify-between gap-2 px-4 py-2.5"
          >
            <span className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {!paused && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cream/60" />
                )}
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cream" />
              </span>
              <Footprints className="h-3.5 w-3.5" strokeWidth={2.2} />
              <span className="text-[12px] font-medium tabular-nums">{elapsed}</span>
              {paused && <span className="text-[10px] uppercase tracking-wider opacity-80">paused</span>}
            </span>
            <ChevronUp className="h-4 w-4 opacity-80" />
          </button>
        ) : (
          <div className="flex flex-col gap-2 px-4 py-3">
            {/* Title row */}
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2 shrink-0">
                {!paused && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cream/60" />
                )}
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cream" />
              </span>
              {podcast ? (
                <Headphones className="h-4 w-4 opacity-90" strokeWidth={2.2} />
              ) : inPod ? (
                <Radio className="h-4 w-4 opacity-90" />
              ) : (
                <Footprints className="h-4 w-4 opacity-90" strokeWidth={2.2} />
              )}
              <span className="text-[13px] font-medium leading-none tabular-nums">{elapsed}</span>
              <span className="h-3 w-px bg-cream/30" />
              <span className="min-w-0 flex-1 truncate text-[12px] opacity-90">{title}</span>
              {inPod && active.roomParticipantCount && (
                <span className="flex items-center gap-0.5 text-[11px] opacity-90">
                  <Users className="h-3 w-3" />
                  <span className="tabular-nums">{active.roomParticipantCount}</span>
                </span>
              )}
            </div>

            {podcast?.host && (
              <div className="-mt-1 truncate pl-4 text-[11px] opacity-70">{podcast.host}</div>
            )}

            {/* Controls row */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePauseTap}
                aria-label={paused ? "Resume" : "Pause"}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-cream/15 transition active:scale-[0.94]"
              >
                {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </button>

              {hasInlineAudio && (
                <button
                  type="button"
                  onClick={handleMuteTap}
                  aria-label={audioMuted ? "Unmute audio" : "Mute audio"}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-cream/15 transition active:scale-[0.94]"
                >
                  {audioMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              )}

              <button
                type="button"
                onClick={goReturn}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-cream/15 px-3 py-2 text-[12px] font-medium transition active:scale-[0.97]"
              >
                <Footprints className="h-3.5 w-3.5" strokeWidth={2.2} />
                Return
              </button>
              <button
                type="button"
                onClick={handleEnd}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleHardEnd();
                }}
                className="flex items-center justify-center gap-1.5 rounded-full border border-cream/30 bg-transparent px-3 py-2 text-[12px] font-medium opacity-90 transition active:scale-[0.97]"
                aria-label="End walk"
              >
                <Square className="h-3.5 w-3.5" />
                End
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes live-pill-in {
          from { transform: translateY(120%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
