import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Pause, Play, X, Music2, Loader2, ChevronUp } from "lucide-react";
import { useAmbient } from "@/lib/ambient-context";
import { usePlayer } from "@/lib/player-context";
import { NowPlayingSheet } from "@/components/now-playing-sheet";
import { ambientCover } from "@/lib/ambient-cover";

const HIDDEN_EXACT = new Set(["/auth", "/welcome"]);
const HIDDEN_PREFIX = ["/w/"];

export function NowPlayingDock() {
  const { current: ambientTrack, playing: ambientPlaying, stop: ambientStop, toggleMute, muted } = useAmbient();
  const { current: audioTrack, playing: audioPlaying, loading: audioLoading, toggle: audioToggle, stop: audioStop } = usePlayer();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);

  // Foreground audio takes priority over ambient in the dock.
  const showAudio = !!audioTrack;
  const showAmbient = !showAudio && !!ambientTrack;
  if (!showAudio && !showAmbient) return null;
  if (HIDDEN_EXACT.has(path)) return null;
  for (const p of HIDDEN_PREFIX) if (path.startsWith(p)) return null;

  const title = showAudio ? audioTrack!.title : ambientTrack!.title;
  const subtitle = showAudio ? audioTrack!.subtitle ?? null : ambientTrack!.artist;
  const onToggle = showAudio ? audioToggle : toggleMute;
  const onClose = showAudio ? audioStop : () => ambientStop();
  const isPaused = showAudio ? !audioPlaying : (muted || !ambientPlaying);
  const canExpand = true;
  const cover = showAudio ? audioTrack?.cover ?? null : ambientCover(ambientTrack);

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4 md:hidden"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}
        aria-live="polite"
        aria-atomic="true"
      >
        <AnimatePresence>
          <motion.div
            key={showAudio ? `audio-${audioTrack!.id}` : `amb-${ambientTrack!.id}`}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="pointer-events-auto flex max-w-[min(420px,calc(100vw-2rem))] items-center gap-1 rounded-full border border-border/60 bg-background/75 py-1.5 pl-2 pr-1.5 shadow-floating backdrop-blur-xl supports-[backdrop-filter]:bg-background/55"
          >
            <button
              type="button"
              onClick={canExpand ? () => setExpanded(true) : undefined}
              disabled={!canExpand}
              aria-label="Open player"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-full py-0.5 pl-0.5 pr-1 text-left transition active:scale-[0.99] disabled:cursor-default"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-forest">
                {cover ? (
                  <img src={cover} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Music2 className="h-3.5 w-3.5" />
                )}
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[12px] font-medium">{title}</div>
                {subtitle && <div className="truncate text-[10px] text-muted-foreground">{subtitle}</div>}
              </div>
              {canExpand && <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              aria-label={isPaused ? "Play" : "Pause"}
              className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition hover:text-foreground"
            >
              {showAudio && audioLoading ? <Loader2 className="h-4 w-4 animate-spin" /> :
                isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              aria-label="Close"
              className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

       <NowPlayingSheet open={expanded} onOpenChange={setExpanded} mode={showAudio ? "audio" : "ambient"} />
    </>
  );
}
