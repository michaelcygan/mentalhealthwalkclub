import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAmbient } from "@/lib/ambient-context";

export type PlayableKind = "podcast" | "guided";

export interface PlayableTrack {
  id: string;
  kind: PlayableKind;
  title: string;
  subtitle?: string | null;
  cover?: string | null;
  audio_url: string;
  link?: string | null;
  duration_seconds?: number | null;
}

interface PlayerCtx {
  current: PlayableTrack | null;
  playing: boolean;
  loading: boolean;
  position: number;
  duration: number;
  queue: PlayableTrack[];
  play: (t: PlayableTrack) => void;
  toggle: () => void;
  stop: () => void;
  seek: (sec: number) => void;
  enqueue: (t: PlayableTrack) => void;
  playNext: (t: PlayableTrack) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  skipNext: () => void;
  skipBy: (deltaSec: number) => void;
  sleepTimerEndsAt: number | null;
  sleepTimerRemainingMs: number | null;
  setSleepTimer: (minutes: number | null) => void;
}

const Ctx = createContext<PlayerCtx | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<PlayableTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState<PlayableTrack[]>([]);
  const queueRef = useRef<PlayableTrack[]>([]);
  useEffect(() => { queueRef.current = queue; }, [queue]);

  // Sleep timer — fades out and stops playback after N minutes.
  const [sleepTimerEndsAt, setSleepTimerEndsAt] = useState<number | null>(null);
  const [sleepTimerRemainingMs, setSleepTimerRemainingMs] = useState<number | null>(null);
  const sleepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pause ambient music when foreground audio takes over
  const ambient = useAmbient();
  const ambientRef = useRef(ambient);
  useEffect(() => { ambientRef.current = ambient; }, [ambient]);

  const playInternalRef = useRef<((t: PlayableTrack) => void) | null>(null);

  const positionTickRef = useRef(0);
  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const el = new Audio();
    el.preload = "metadata";
    el.addEventListener("loadedmetadata", () => setDuration(el.duration || 0));
    el.addEventListener("timeupdate", () => {
      // Native timeupdate fires ~4 Hz; throttle to ~1 Hz so the whole
      // consumer tree doesn't re-render that often.
      const now = Date.now();
      if (now - positionTickRef.current < 950) return;
      positionTickRef.current = now;
      setPosition(el.currentTime || 0);
    });
    el.addEventListener("playing", () => { setPlaying(true); setLoading(false); });
    el.addEventListener("pause", () => setPlaying(false));
    el.addEventListener("waiting", () => setLoading(true));
    el.addEventListener("canplay", () => setLoading(false));
    el.addEventListener("ended", () => {
      // Auto-advance from queue if anything is waiting.
      const next = queueRef.current[0];
      if (next && playInternalRef.current) {
        setQueue((q) => q.slice(1));
        playInternalRef.current(next);
      } else {
        setPlaying(false);
        setPosition(0);
      }
    });
    el.addEventListener("error", () => {
      setLoading(false);
      setPlaying(false);
      toast.error("Couldn't play this track. Try opening the source.");
    });
    audioRef.current = el;
    return el;
  }, []);

  const play = useCallback((t: PlayableTrack) => {
    if (!t.audio_url) {
      if (t.link) window.open(t.link, "_blank", "noopener,noreferrer");
      else toast.error("No audio available for this episode.");
      return;
    }
    const el = ensureAudio();
    // Same track: toggle play/pause
    if (current && current.id === t.id && current.kind === t.kind) {
      if (el.paused) { el.play().catch(() => {}); } else { el.pause(); }
      return;
    }
    // Pause ambient loops while podcast/guided plays
    try { ambientRef.current?.stop(300); } catch { /* noop */ }
    el.pause();
    el.src = t.audio_url;
    el.currentTime = 0;
    setCurrent(t);
    setPosition(0);
    setDuration(t.duration_seconds ?? 0);
    setLoading(true);
    el.play().catch(() => {
      setLoading(false);
      toast.error("Couldn't start playback.");
    });
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: t.title,
          artist: t.subtitle ?? "Mental Health Walk Club",
        });
        navigator.mediaSession.setActionHandler("play", () => el.play().catch(() => {}));
        navigator.mediaSession.setActionHandler("pause", () => el.pause());
        navigator.mediaSession.setActionHandler("seekbackward", () => {
          el.currentTime = Math.max(0, (el.currentTime || 0) - 15);
        });
        navigator.mediaSession.setActionHandler("seekforward", () => {
          el.currentTime = Math.min(el.duration || el.currentTime, (el.currentTime || 0) + 15);
        });
      } catch { /* noop */ }
    }
  }, [current, ensureAudio]);
  useEffect(() => { playInternalRef.current = play; }, [play]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el || !current) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }, [current]);

  const stop = useCallback(() => {
    const el = audioRef.current;
    if (el) { el.pause(); el.src = ""; }
    setCurrent(null);
    setPlaying(false);
    setLoading(false);
    setPosition(0);
    setDuration(0);
    setQueue([]);
  }, []);

  const seek = useCallback((sec: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(sec, el.duration || sec));
  }, []);

  const skipBy = useCallback((deltaSec: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min((el.duration || el.currentTime) , (el.currentTime || 0) + deltaSec));
  }, []);

  const enqueue = useCallback((t: PlayableTrack) => {
    if (!current) {
      // Nothing playing → start immediately.
      play(t);
      return;
    }
    if (current.id === t.id) {
      toast("Already playing this");
      return;
    }
    setQueue((q) => {
      if (q.some((x) => x.id === t.id)) return q;
      return [...q, t];
    });
    toast.success("Added to queue");
  }, [current, play]);

  const playNext = useCallback((t: PlayableTrack) => {
    if (!current) { play(t); return; }
    setQueue((q) => [t, ...q.filter((x) => x.id !== t.id)]);
    toast.success("Playing next");
  }, [current, play]);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((q) => q.filter((x) => x.id !== id));
  }, []);

  const clearQueue = useCallback(() => setQueue([]), []);

  const skipNext = useCallback(() => {
    const next = queueRef.current[0];
    if (!next) return;
    setQueue((q) => q.slice(1));
    play(next);
  }, [play]);

  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
    if (sleepTickRef.current) clearInterval(sleepTickRef.current);
  }, []);

  const clearSleepInternals = useCallback(() => {
    if (sleepTimeoutRef.current) { clearTimeout(sleepTimeoutRef.current); sleepTimeoutRef.current = null; }
    if (sleepTickRef.current) { clearInterval(sleepTickRef.current); sleepTickRef.current = null; }
    setSleepTimerEndsAt(null);
    setSleepTimerRemainingMs(null);
  }, []);

  const setSleepTimer = useCallback((minutes: number | null) => {
    clearSleepInternals();
    if (!minutes || minutes <= 0) {
      toast("Sleep timer off");
      return;
    }
    const ms = minutes * 60_000;
    const endsAt = Date.now() + ms;
    setSleepTimerEndsAt(endsAt);
    setSleepTimerRemainingMs(ms);
    sleepTickRef.current = setInterval(() => {
      const remaining = endsAt - Date.now();
      setSleepTimerRemainingMs(Math.max(0, remaining));
    }, 1000);
    sleepTimeoutRef.current = setTimeout(() => {
      // Gentle fade-out before stopping.
      const el = audioRef.current;
      if (el) {
        const startVol = el.volume;
        const steps = 12;
        let i = 0;
        const fade = setInterval(() => {
          i += 1;
          el.volume = Math.max(0, startVol * (1 - i / steps));
          if (i >= steps) {
            clearInterval(fade);
            el.pause();
            el.volume = startVol;
          }
        }, 120);
      }
      clearSleepInternals();
      toast("Good night. Sleep timer ended.");
    }, ms);
    toast.success(`Sleep timer set for ${minutes} min`);
  }, [clearSleepInternals]);

  const value = useMemo<PlayerCtx>(() => ({
    current, playing, loading, position, duration, queue,
    play, toggle, stop, seek, enqueue, playNext, removeFromQueue, clearQueue, skipNext, skipBy,
    sleepTimerEndsAt, sleepTimerRemainingMs, setSleepTimer,
  }), [current, playing, loading, position, duration, queue, play, toggle, stop, seek, enqueue, playNext, removeFromQueue, clearQueue, skipNext, skipBy, sleepTimerEndsAt, sleepTimerRemainingMs, setSleepTimer]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer(): PlayerCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer must be used inside PlayerProvider");
  return v;
}
