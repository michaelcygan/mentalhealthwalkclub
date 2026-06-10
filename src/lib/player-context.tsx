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
  play: (t: PlayableTrack) => void;
  toggle: () => void;
  stop: () => void;
  seek: (sec: number) => void;
}

const Ctx = createContext<PlayerCtx | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<PlayableTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  // Pause ambient music when foreground audio takes over
  const ambient = useAmbient();
  const ambientRef = useRef(ambient);
  useEffect(() => { ambientRef.current = ambient; }, [ambient]);

  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const el = new Audio();
    el.preload = "metadata";
    el.addEventListener("loadedmetadata", () => setDuration(el.duration || 0));
    el.addEventListener("timeupdate", () => setPosition(el.currentTime || 0));
    el.addEventListener("playing", () => { setPlaying(true); setLoading(false); });
    el.addEventListener("pause", () => setPlaying(false));
    el.addEventListener("waiting", () => setLoading(true));
    el.addEventListener("canplay", () => setLoading(false));
    el.addEventListener("ended", () => { setPlaying(false); setPosition(0); });
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
      } catch { /* noop */ }
    }
  }, [current, ensureAudio]);

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
  }, []);

  const seek = useCallback((sec: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(sec, el.duration || sec));
  }, []);

  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  const value = useMemo<PlayerCtx>(() => ({
    current, playing, loading, position, duration,
    play, toggle, stop, seek,
  }), [current, playing, loading, position, duration, play, toggle, stop, seek]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer(): PlayerCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer must be used inside PlayerProvider");
  return v;
}
