/**
 * WalkRuntimeProvider — root-level source of truth for the user's active walk.
 *
 * Owns:
 *  - active walk_session lookup (lazy realtime, refetch-on-focus, 6h ceiling)
 *  - global `paused` flag (so pill ↔ active-walk page stay in lockstep)
 *  - podcast audio playback (HTMLAudioElement that survives navigation)
 *
 * Out of scope (this pass):
 *  - Walk & Talk mic / speaker (still owned by the active-walk route).
 *  - Generative guided pad audio (kept inside GuidedPlayer for now).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const MAX_WALK_MS = 6 * 60 * 60 * 1000;
const ENDED_EVENT = "mhwc:walk-ended";

export interface ActiveWalkSummary {
  walkId: string;
  startedAt: number;
  walkType: string;
  guidedTrackId: string | null;
  podcastEpisodeId: string | null;
  audioRoomId: string | null;
  // Room context (only filled for live audio rooms)
  roomTitle: string | null;
  roomParticipantCount: number | null;
}

interface PodcastAudioMeta {
  episodeId: string;
  title: string;
  host: string | null;
  durationSeconds: number;
}

export interface MusicTrackRuntime {
  id: string;
  title: string;
  artist: string | null;
  audio_path: string;
  cover_url: string | null;
  duration_seconds: number;
}

interface MusicQueueState {
  label: string;
  tracks: MusicTrackRuntime[];
  index: number;
  targetDurationSeconds: number | null;
  playedSeconds: number; // cumulative completed-track seconds
}

/**
 * Voice controller — registered by WalkTalkDock when the user is in a live
 * audio room. Lets the global pill render mic mute / leave-room controls
 * without having to lift the WebRTC mesh into this provider.
 */
export interface VoiceController {
  micMuted: boolean;
  toggleMic: () => void;
  leaveRoom: () => Promise<void> | void;
  /** Optional label shown on the pill (e.g. room title). */
  label?: string | null;
}

interface WalkRuntimeValue {
  active: ActiveWalkSummary | null;
  /** True once we've made at least one query (prevents pill flash). */
  ready: boolean;

  paused: boolean;
  togglePause: () => void;

  podcast: PodcastAudioMeta | null;
  /** Has audio we can scrub from the pill (currently: podcast only). */
  hasInlineAudio: boolean;
  audioMuted: boolean;
  toggleAudioMute: () => void;
  audioPlaying: boolean;
  audioPosition: number;

  /** Live audio room controls (null when not in a room). */
  voice: VoiceController | null;
  registerVoice: (c: VoiceController | null) => void;

  /** Mark the walk ended in the DB and clear local state. Does not navigate. */
  endActiveWalk: () => Promise<void>;
  /** Force-refresh the active-walk lookup. */
  refresh: () => void;
  /**
   * Eagerly seed podcast audio before the walk row even exists in `active`.
   * Called by the composer the moment a user picks an episode, so audio
   * starts buffering in parallel with the walk_sessions insert and route
   * navigation. Safe to call multiple times.
   */
  primePodcast: (meta: { episodeId: string; title: string; host: string | null; durationSeconds: number; audioUrl: string }) => void;
  /** Music queue (single track or shuffled timed mix). Auto-advances; auto-stops at target duration if set. */
  music: { label: string; current: MusicTrackRuntime | null; upNext: MusicTrackRuntime | null; targetDurationSeconds: number | null } | null;
  primeMusicPlaylist: (input: { tracks: MusicTrackRuntime[]; targetDurationSeconds: number | null; label: string }) => void;
}

const Ctx = createContext<WalkRuntimeValue | null>(null);

export function useWalkRuntime() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWalkRuntime must be used inside WalkRuntimeProvider");
  return v;
}

export function WalkRuntimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [active, setActive] = useState<ActiveWalkSummary | null>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [podcast, setPodcast] = useState<PodcastAudioMeta | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioPosition, setAudioPosition] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inFlight = useRef(false);
  const dismissedIds = useRef<Set<string>>(new Set());

  // ---- Music queue state ----
  const musicQueueRef = useRef<MusicQueueState | null>(null);
  const [musicSnapshot, setMusicSnapshot] = useState<{
    label: string;
    current: MusicTrackRuntime | null;
    upNext: MusicTrackRuntime | null;
    targetDurationSeconds: number | null;
  } | null>(null);

  const publishMusic = useCallback(() => {
    const q = musicQueueRef.current;
    if (!q) { setMusicSnapshot(null); return; }
    const current = q.tracks[q.index] ?? null;
    const upNext = q.tracks[q.index + 1] ?? null;
    setMusicSnapshot({ label: q.label, current, upNext, targetDurationSeconds: q.targetDurationSeconds });
  }, []);

  const load = useCallback(async () => {
    if (!user || inFlight.current) return;
    inFlight.current = true;
    try {
      const { data: w } = await supabase
        .from("walk_sessions")
        .select(
          "id, started_at, walk_type, guided_track_id, podcast_episode_id, audio_room_id",
        )
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!w || dismissedIds.current.has(w.id)) {
        setActive(null);
        setReady(true);
        return;
      }
      const startedAt = new Date(w.started_at ?? Date.now()).getTime();
      if (Date.now() - startedAt > MAX_WALK_MS) {
        dismissedIds.current.add(w.id);
        await supabase
          .from("walk_sessions")
          .update({ status: "abandoned", ended_at: new Date().toISOString() })
          .eq("id", w.id)
          .eq("status", "active");
        setActive(null);
        setReady(true);
        return;
      }
      let roomTitle: string | null = null;
      let roomParticipantCount: number | null = null;
      if (w.audio_room_id) {
        const { data: p } = await supabase
          .from("audio_room_participants")
          .select("audio_rooms(title, current_participant_count, status)")
          .eq("user_id", user.id)
          .eq("walk_session_id", w.id)
          .eq("status", "active")
          .maybeSingle();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const room = (p as any)?.audio_rooms;
        if (room && room.status === "open") {
          roomTitle = room.title ?? "Walk & Talk";
          roomParticipantCount = room.current_participant_count ?? 1;
        }
      }
      setActive({
        walkId: w.id,
        startedAt,
        walkType: w.walk_type,
        guidedTrackId: w.guided_track_id,
        podcastEpisodeId: w.podcast_episode_id,
        audioRoomId: w.audio_room_id,
        roomTitle,
        roomParticipantCount,
      });
      setReady(true);
    } finally {
      inFlight.current = false;
    }
  }, [user]);

  // Initial load + focus refetch
  useEffect(() => {
    if (!user) {
      setActive(null);
      setReady(true);
      return;
    }
    setReady(false);
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user, load]);

  // Lazy realtime
  useEffect(() => {
    if (!user || !active) return;
    const ch = supabase
      .channel(`walk-runtime-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "walk_sessions", filter: `user_id=eq.${user.id}` },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "audio_room_participants", filter: `user_id=eq.${user.id}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, active, load]);

  // Local broadcast for instant dismissal
  useEffect(() => {
    const onEnded = (e: Event) => {
      const id = (e as CustomEvent<{ walkId?: string }>).detail?.walkId;
      if (id) dismissedIds.current.add(id);
      setActive(null);
      setPaused(false);
      teardownAudio();
    };
    window.addEventListener(ENDED_EVENT, onEnded as EventListener);
    return () => window.removeEventListener(ENDED_EVENT, onEnded as EventListener);
  }, []);

  // Reset paused when walk changes
  useEffect(() => {
    setPaused(false);
  }, [active?.walkId]);

  // ---- Audio lifecycle (shared between podcast + music) ----
  const teardownAudio = () => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.src = "";
      audioRef.current = null;
    }
    setPodcast(null);
    setAudioMuted(false);
    setAudioPlaying(false);
    setAudioPosition(0);
    primedEpisodeIdRef.current = null;
    musicQueueRef.current = null;
    setMusicSnapshot(null);
  };

  // Track which episode is already primed/loaded to dedupe with the active-walk effect
  const primedEpisodeIdRef = useRef<string | null>(null);

  const onEndedRef = useRef<(() => void) | null>(null);

  const buildAudio = useCallback((src: string) => {
    const prev = audioRef.current;
    if (prev) {
      prev.pause();
      prev.src = "";
    }
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.volume = 0.85;
    audio.muted = audioMuted;
    audio.addEventListener("timeupdate", () => {
      setAudioPosition(Math.floor(audio.currentTime));
    });
    audio.addEventListener("play", () => setAudioPlaying(true));
    audio.addEventListener("pause", () => setAudioPlaying(false));
    audio.addEventListener("ended", () => {
      setAudioPlaying(false);
      onEndedRef.current?.();
    });
    audioRef.current = audio;
    audio.play().catch(() => {
      /* needs user gesture; pill controls will retrigger */
    });
    return audio;
  }, [audioMuted]);

  const buildPodcastAudio = useCallback((meta: PodcastAudioMeta, audioUrl: string) => {
    onEndedRef.current = null;
    musicQueueRef.current = null;
    setMusicSnapshot(null);
    buildAudio(audioUrl);
    setPodcast(meta);
    primedEpisodeIdRef.current = meta.episodeId;
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: meta.title,
        artist: meta.host ?? "Mental Health Walk Club",
        album: "Walk podcast",
      });
    }
  }, [buildAudio]);

  // ---- Music queue ----
  const playCurrentMusic = useCallback(async () => {
    const q = musicQueueRef.current;
    if (!q) return;
    const track = q.tracks[q.index];
    if (!track) return;
    const { data } = await supabase.storage.from("ambient-music").createSignedUrl(track.audio_path, 60 * 60 * 2);
    if (!data?.signedUrl) return;
    if (musicQueueRef.current !== q) return; // queue swapped while signing
    buildAudio(data.signedUrl);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist ?? "Mental Health Walk Club",
        album: q.label,
        artwork: track.cover_url ? [{ src: track.cover_url, sizes: "512x512" }] : undefined,
      });
    }
    publishMusic();
  }, [buildAudio, publishMusic]);

  const advanceMusic = useCallback(() => {
    const q = musicQueueRef.current;
    if (!q) return;
    const finished = q.tracks[q.index];
    q.playedSeconds += finished?.duration_seconds ?? 0;
    // Stop if past target (with small overshoot tolerance)
    if (q.targetDurationSeconds && q.playedSeconds >= q.targetDurationSeconds) {
      musicQueueRef.current = null;
      setMusicSnapshot(null);
      const a = audioRef.current;
      if (a) { a.pause(); a.src = ""; audioRef.current = null; }
      setAudioPlaying(false);
      setAudioPosition(0);
      return;
    }
    // Loop within shuffled queue
    q.index = (q.index + 1) % q.tracks.length;
    void playCurrentMusic();
  }, [playCurrentMusic]);

  // Keep ended handler reference fresh
  useEffect(() => {
    onEndedRef.current = musicSnapshot ? advanceMusic : null;
  }, [musicSnapshot, advanceMusic]);

  const primeMusicPlaylist = useCallback<WalkRuntimeValue["primeMusicPlaylist"]>((input) => {
    if (!input.tracks?.length) return;
    musicQueueRef.current = {
      label: input.label,
      tracks: input.tracks,
      index: 0,
      targetDurationSeconds: input.targetDurationSeconds,
      playedSeconds: 0,
    };
    setPodcast(null);
    primedEpisodeIdRef.current = null;
    publishMusic();
    void playCurrentMusic();
  }, [playCurrentMusic, publishMusic]);


  const primePodcast = useCallback<WalkRuntimeValue["primePodcast"]>((m) => {
    if (primedEpisodeIdRef.current === m.episodeId) return;
    buildAudio(
      { episodeId: m.episodeId, title: m.title, host: m.host, durationSeconds: m.durationSeconds },
      m.audioUrl,
    );
  }, [buildAudio]);

  // Load podcast when active walk has one (and tear down when it doesn't)
  useEffect(() => {
    const epId = active?.podcastEpisodeId ?? null;
    if (!epId) {
      primedEpisodeIdRef.current = null;
      teardownAudio();
      return;
    }
    if (primedEpisodeIdRef.current === epId) return; // already primed/loaded

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("podcast_episodes")
        .select("id,title,audio_url,duration_seconds,feed:podcast_feeds(title,publisher)")
        .eq("id", epId)
        .maybeSingle();
      if (cancelled || !data) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const feed = (data as any).feed;
      const meta: PodcastAudioMeta = {
        episodeId: data.id,
        title: data.title,
        host: feed?.publisher ?? feed?.title ?? null,
        durationSeconds: data.duration_seconds ?? 0,
      };
      buildAudio(meta, data.audio_url);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.podcastEpisodeId]);

  // Sync paused → audio
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (paused) a.pause();
    else a.play().catch(() => {});
  }, [paused]);

  const togglePause = useCallback(() => setPaused((p) => !p), []);

  const toggleAudioMute = useCallback(() => {
    setAudioMuted((m) => {
      const next = !m;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }, []);

  // ---- Voice controller registration (Walk & Talk / friend room) ----
  const [voice, setVoice] = useState<VoiceController | null>(null);
  const registerVoice = useCallback((c: VoiceController | null) => {
    setVoice(c);
  }, []);

  const endActiveWalk = useCallback(async () => {
    if (!active) return;
    const id = active.walkId;
    dismissedIds.current.add(id);
    // Best-effort leave any live voice room before ending
    try {
      await voice?.leaveRoom();
    } catch {
      /* noop */
    }
    setVoice(null);
    setActive(null);
    setPaused(false);
    teardownAudio();
    await supabase
      .from("walk_sessions")
      .update({ status: "completed", ended_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "active");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(ENDED_EVENT, { detail: { walkId: id } }));
    }
  }, [active, voice]);

  // Clear voice registration when active walk ends/changes
  useEffect(() => {
    if (!active) setVoice(null);
  }, [active?.walkId]);

  const value = useMemo<WalkRuntimeValue>(
    () => ({
      active,
      ready,
      paused,
      togglePause,
      podcast,
      hasInlineAudio: !!podcast,
      audioMuted,
      toggleAudioMute,
      audioPlaying,
      audioPosition,
      voice,
      registerVoice,
      endActiveWalk,
      refresh: load,
      primePodcast,
    }),
    [active, ready, paused, togglePause, podcast, audioMuted, toggleAudioMute, audioPlaying, audioPosition, voice, registerVoice, endActiveWalk, load, primePodcast],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Helper: dispatch the global "walk ended" event from anywhere. */
export function broadcastWalkEnded(walkId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ENDED_EVENT, { detail: { walkId } }));
}
