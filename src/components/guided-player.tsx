import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AmbientPad } from "@/lib/audio/ambient-pad";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

interface Track {
  id: string; title: string; host: string | null; host_role: string | null;
  audio_url: string | null; generative_key: string | null; duration_seconds: number;
}

export function GuidedPlayer({ trackId, paused = false }: { trackId: string; paused?: boolean }) {
  const [track, setTrack] = useState<Track | null>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [pos, setPos] = useState(0);
  const [ended, setEnded] = useState(false);
  const padRef = useRef<AmbientPad | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    supabase.from("guided_tracks").select("id,title,host,host_role,audio_url,generative_key,duration_seconds").eq("id", trackId).maybeSingle()
      .then(({ data }) => setTrack(data as Track | null));
  }, [trackId]);

  // tick position
  useEffect(() => {
    if (!started || ended) return;
    const t = setInterval(() => {
      if (audioRef.current) setPos(Math.floor(audioRef.current.currentTime));
      else setPos((p) => p + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [started, ended]);

  // Sync with parent paused state
  useEffect(() => {
    if (!started) return;
    if (paused) {
      padRef.current?.duck(0);
      audioRef.current?.pause();
      setPlaying(false);
    } else if (!ended) {
      if (padRef.current) padRef.current.swell(0.16);
      audioRef.current?.play().catch(() => {});
      setPlaying(true);
    }
  }, [paused, started, ended]);

  const begin = async () => {
    if (!track || started) return;
    setStarted(true); setPlaying(true);
    if (track.generative_key) {
      const pad = new AmbientPad();
      padRef.current = pad;
      await pad.start(0.16, track.generative_key);
    } else if (track.audio_url) {
      const a = new Audio(track.audio_url);
      a.loop = false; a.volume = 0.7;
      a.addEventListener("ended", () => { setEnded(true); setPlaying(false); });
      audioRef.current = a;
      try { await a.play(); } catch { /* noop */ }
    }
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title, artist: track.host ?? "Mental Health Walk Club", album: "Guided Walk",
      });
    }
  };

  useEffect(() => () => {
    padRef.current?.stop(); padRef.current = null;
    audioRef.current?.pause(); audioRef.current = null;
  }, []);

  const toggle = () => {
    if (!started) { begin(); return; }
    setPlaying((p) => {
      const next = !p;
      if (padRef.current) next ? padRef.current.swell(0.16) : padRef.current.duck(0);
      if (audioRef.current) next ? audioRef.current.play().catch(() => {}) : audioRef.current.pause();
      return next;
    });
  };
  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      if (padRef.current) next ? padRef.current.duck(0) : padRef.current.swell(0.16);
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  };

  if (!track) return null;

  const dur = track.duration_seconds || 1;
  const pct = Math.min(100, (pos / dur) * 100);
  const remain = Math.max(0, dur - pos);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-forest/30 bg-card/80 p-4 backdrop-blur">
      <div className="absolute inset-0 -z-10 opacity-40 gradient-warm" />
      <div className="flex items-center gap-3">
        <button onClick={toggle} className="flex h-12 w-12 items-center justify-center rounded-full bg-forest text-primary-foreground shadow-soft transition active:scale-95" aria-label={!started ? "Start" : playing ? "Pause" : "Play"}>
          {!started || !playing ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-serif text-base leading-tight">{track.title}</div>
          <div className="truncate text-xs text-muted-foreground">{track.host}{track.host_role ? ` · ${track.host_role}` : ""}</div>
        </div>
        {started && (
          <button onClick={toggleMute} className="rounded-full p-2 text-muted-foreground hover:text-forest" aria-label={muted ? "Unmute" : "Mute"}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        )}
      </div>
      {started && (
        <div className="mt-3">
          <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/10">
            <div className="h-full bg-forest transition-all duration-1000" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
            <span>{fmt(pos)}</span>
            <span>{ended ? "your guide is finished — walk continues" : `−${fmt(remain)}`}</span>
          </div>
        </div>
      )}
      {!started && (
        <p className="mt-2 text-center text-[11px] italic text-muted-foreground">Tap to begin — your guide will fade in.</p>
      )}
    </div>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${m}:${String(sec).padStart(2,"0")}`;
}
