import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AmbientPad } from "@/lib/audio/ambient-pad";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

interface Track {
  id: string; title: string; host: string | null; host_role: string | null;
  audio_url: string | null; generative_key: string | null; duration_seconds: number;
}

export function GuidedPlayer({ trackId }: { trackId: string }) {
  const [track, setTrack] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const padRef = useRef<AmbientPad | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    supabase.from("guided_tracks").select("id,title,host,host_role,audio_url,generative_key,duration_seconds").eq("id", trackId).maybeSingle()
      .then(({ data }) => setTrack(data as Track | null));
  }, [trackId]);

  useEffect(() => {
    if (!track) return;
    if (track.generative_key) {
      const pad = new AmbientPad();
      padRef.current = pad;
      pad.start(0.16, track.generative_key);
    } else if (track.audio_url) {
      const a = new Audio(track.audio_url);
      a.loop = false; a.volume = 0.7;
      audioRef.current = a;
      a.play().catch(() => {});
    }
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title, artist: track.host ?? "Walk Club", album: "Guided Walk",
      });
    }
    return () => {
      padRef.current?.stop(); padRef.current = null;
      audioRef.current?.pause(); audioRef.current = null;
    };
  }, [track]);

  const toggle = () => {
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

  return (
    <div className="relative overflow-hidden rounded-2xl border border-forest/30 bg-card/80 p-4 backdrop-blur">
      <div className="absolute inset-0 -z-10 opacity-40 gradient-warm" />
      <div className="flex items-center gap-3">
        <button onClick={toggle} className="flex h-12 w-12 items-center justify-center rounded-full bg-forest text-primary-foreground shadow-soft transition active:scale-95" aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-serif text-base leading-tight">{track.title}</div>
          <div className="truncate text-xs text-muted-foreground">{track.host}{track.host_role ? ` · ${track.host_role}` : ""}</div>
        </div>
        <button onClick={toggleMute} className="rounded-full p-2 text-muted-foreground hover:text-forest" aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
