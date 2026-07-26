import { useCallback, useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Pause, Play, X, Music2, Loader2, ChevronUp } from "lucide-react";
import { useAmbient } from "@/lib/ambient-context";
import { usePlayer } from "@/lib/player-context";
import { recordRadioUsage } from "@/lib/radio-client";
import { useAuth } from "@/lib/auth-context";
import { NowPlayingSheet } from "@/components/now-playing-sheet";
import { ambientCover } from "@/lib/ambient-cover";

const HIDDEN_EXACT = new Set(["/auth", "/welcome"]);
const HIDDEN_PREFIX = ["/w/"];

export function NowPlayingDock() {
  const { current: ambientTrack, playing: ambientPlaying, stop: ambientStop, toggleMute, muted } = useAmbient();
  const {
    current: audioTrack,
    playing: audioPlaying,
    loading: audioLoading,
    toggle: audioToggle,
    stop: audioStop,
    position,
  } = usePlayer();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const { user } = useAuth();

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

  // Record radio listening time for Plus analytics and free-tier enforcement.
  const lastRadioIdRef = useRef<string | null>(null);
  const lastPosRef = useRef(0);
  const accSecondsRef = useRef(0);
  const flush = useCallback(async () => {
    const secs = Math.floor(accSecondsRef.current);
    if (secs > 0) {
      accSecondsRef.current -= secs;
      try {
        await recordRadioUsage(secs);
      } catch {
        // If the RPC fails, put the seconds back so we retry on next flush.
        accSecondsRef.current += secs;
      }
    }
  }, []);

  useEffect(() => {
    const isRadio = audioTrack?.id.startsWith("radio:");
    if (!isRadio || !user) {
      lastRadioIdRef.current = null;
      lastPosRef.current = 0;
      return;
    }
    const currentId = audioTrack!.id;
    if (lastRadioIdRef.current && lastRadioIdRef.current !== currentId) {
      void flush();
    }
    lastRadioIdRef.current = currentId;
    lastPosRef.current = 0;
    return () => {
      void flush();
    };
  }, [audioTrack?.id, user, flush]);

  useEffect(() => {
    const isRadio = audioTrack?.id.startsWith("radio:");
    if (!isRadio || !audioPlaying || !user) return;
    const delta = Math.max(0, Math.min(60, position - lastPosRef.current));
    lastPosRef.current = position;
    if (delta > 0) {
      accSecondsRef.current += delta;
      if (accSecondsRef.current >= 60) {
        void flush();
      }
    }
  }, [audioTrack, audioPlaying, position, user, flush]);

  useEffect(() => {
    if (!audioPlaying) {
      void flush();
    }
  }, [audioPlaying, flush]);

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
