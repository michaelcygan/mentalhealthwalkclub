import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export interface AmbientTrack {
  id: string;
  title: string;
  artist: string | null;
  audio_path: string;
  cover_path: string | null;
  duration_seconds: number;
}

interface AmbientCtx {
  current: AmbientTrack | null;
  playing: boolean;
  muted: boolean;
  volume: number;
  start: () => Promise<void>;
  stop: (fadeMs?: number) => void;
  skip: () => void;
  toggleMute: () => void;
  setVolume: (v: number) => void;
  hasLibrary: boolean;
}

const Ctx = createContext<AmbientCtx | null>(null);

const VOL_KEY = "mhwc_ambient_volume";
const MUTE_KEY = "mhwc_ambient_muted";
const FADE_MS = 1500;

function shuffle<T>(arr: T[], avoidFirst?: T) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (avoidFirst && a.length > 1 && a[0] === avoidFirst) [a[0], a[1]] = [a[1], a[0]];
  return a;
}

export function AmbientPlayerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [library, setLibrary] = useState<AmbientTrack[]>([]);
  const [current, setCurrent] = useState<AmbientTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(MUTE_KEY) === "1";
  });
  const [volume, setVolumeState] = useState<number>(() => {
    if (typeof window === "undefined") return 0.3;
    const v = Number(window.localStorage.getItem(VOL_KEY));
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.3;
  });

  const queue = useRef<AmbientTrack[]>([]);
  const audioA = useRef<HTMLAudioElement | null>(null);
  const audioB = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef<"a" | "b">("a");
  const fadeRaf = useRef<number | null>(null);

  // Load library when authed
  useEffect(() => {
    if (!user) { setLibrary([]); return; }
    supabase
      .from("ambient_tracks")
      .select("id,title,artist,audio_path,cover_path,duration_seconds")
      .eq("is_active", true)
      .then(({ data }) => setLibrary((data ?? []) as AmbientTrack[]));
  }, [user]);

  // Effective gain: 0 when muted, else `volume`
  const effectiveGain = muted ? 0 : volume;

  // Apply volume to active element instantly
  useEffect(() => {
    const el = activeRef.current === "a" ? audioA.current : audioB.current;
    if (el) el.volume = effectiveGain;
  }, [effectiveGain]);

  const sign = useCallback(async (path: string) => {
    const { data } = await supabase.storage.from("ambient-music").createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  }, []);

  const refillQueue = useCallback(() => {
    if (library.length === 0) { queue.current = []; return; }
    queue.current = shuffle(library, current ?? undefined);
  }, [library, current]);

  // Crossfade helper
  const crossfadeTo = useCallback((nextEl: HTMLAudioElement, target: number) => {
    if (fadeRaf.current) cancelAnimationFrame(fadeRaf.current);
    const prevEl = activeRef.current === "a" ? audioA.current : audioB.current;
    const startVol = prevEl?.volume ?? 0;
    nextEl.volume = 0;
    nextEl.play().catch(() => {});
    const t0 = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - t0) / FADE_MS);
      if (prevEl) prevEl.volume = startVol * (1 - t);
      nextEl.volume = target * t;
      if (t < 1) {
        fadeRaf.current = requestAnimationFrame(tick);
      } else {
        if (prevEl) { prevEl.pause(); prevEl.src = ""; }
        activeRef.current = activeRef.current === "a" ? "b" : "a";
        fadeRaf.current = null;
      }
    };
    fadeRaf.current = requestAnimationFrame(tick);
  }, []);

  const playTrack = useCallback(async (track: AmbientTrack, withFade: boolean) => {
    const url = await sign(track.audio_path);
    if (!url) return;
    if (!audioA.current) { audioA.current = new Audio(); audioA.current.preload = "auto"; }
    if (!audioB.current) { audioB.current = new Audio(); audioB.current.preload = "auto"; }
    const nextSlot = activeRef.current === "a" ? "b" : "a";
    const nextEl = nextSlot === "a" ? audioA.current : audioB.current;
    nextEl.src = url;
    nextEl.onended = () => advance();
    setCurrent(track);
    setPlaying(true);
    if (withFade) {
      crossfadeTo(nextEl, effectiveGain);
    } else {
      const prevEl = activeRef.current === "a" ? audioA.current : audioB.current;
      if (prevEl) { prevEl.pause(); prevEl.src = ""; }
      activeRef.current = nextSlot;
      nextEl.volume = effectiveGain;
      try { await nextEl.play(); } catch { /* gesture needed */ }
    }
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist ?? "Mental Health Walk Club",
        album: "Walk ambience",
        artwork: track.cover_path ? [{ src: track.cover_path }] : undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sign, effectiveGain, crossfadeTo]);

  const advance = useCallback(async () => {
    if (queue.current.length === 0) refillQueue();
    const next = queue.current.shift();
    if (!next) { setPlaying(false); setCurrent(null); return; }
    await playTrack(next, true);
  }, [playTrack, refillQueue]);

  const start = useCallback(async () => {
    if (library.length === 0) return;
    if (current) return; // already running
    refillQueue();
    const first = queue.current.shift();
    if (!first) return;
    await playTrack(first, false);
  }, [current, library, playTrack, refillQueue]);

  const stop = useCallback((fadeMs = 600) => {
    const el = activeRef.current === "a" ? audioA.current : audioB.current;
    if (!el) { setPlaying(false); setCurrent(null); return; }
    if (fadeRaf.current) cancelAnimationFrame(fadeRaf.current);
    const startVol = el.volume;
    const t0 = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - t0) / fadeMs);
      el.volume = startVol * (1 - t);
      if (t < 1) {
        fadeRaf.current = requestAnimationFrame(tick);
      } else {
        el.pause(); el.src = "";
        if (audioA.current) { audioA.current.pause(); audioA.current.src = ""; }
        if (audioB.current) { audioB.current.pause(); audioB.current.src = ""; }
        setPlaying(false); setCurrent(null);
        fadeRaf.current = null;
      }
    };
    fadeRaf.current = requestAnimationFrame(tick);
  }, []);

  const skip = useCallback(() => { advance(); }, [advance]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      if (typeof window !== "undefined") window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (typeof window !== "undefined") window.localStorage.setItem(VOL_KEY, String(clamped));
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    if (fadeRaf.current) cancelAnimationFrame(fadeRaf.current);
    audioA.current?.pause(); audioB.current?.pause();
  }, []);

  const value = useMemo<AmbientCtx>(() => ({
    current, playing, muted, volume,
    start, stop, skip, toggleMute, setVolume,
    hasLibrary: library.length > 0,
  }), [current, playing, muted, volume, start, stop, skip, toggleMute, setVolume, library.length]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAmbient(): AmbientCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAmbient must be used inside AmbientPlayerProvider");
  return v;
}
