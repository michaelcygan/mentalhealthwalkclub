/**
 * Guided walk module — wraps the guided audio player.
 *
 * For `guided_tracks` (generative pads), GuidedPlayer owns the audio.
 * For `podcast_episodes`, the global WalkRuntime owns the HTMLAudioElement
 * (so playback survives navigation and the Live pill can pause/mute it).
 * This module renders a presentational card bound to runtime state for the
 * podcast branch.
 */
import { GuidedPlayer } from "@/components/guided-player";
import { SoloModule } from "./solo-module";
import { useWalkRuntime } from "@/lib/walk-runtime";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";

interface Props {
  trackId: string | null;
  podcastEpisodeId?: string | null;
  paused: boolean;
  intention: string | null;
  savedPrompts: string[];
  onChangePodcast?: () => void;
}

export function GuidedModule({ trackId, podcastEpisodeId, paused, intention, savedPrompts, onChangePodcast }: Props) {
  const { music } = useWalkRuntime();
  return (
    <section className="space-y-3">
      <SoloModule intention={intention} savedPrompts={savedPrompts} />
      {music ? (
        <RuntimeMusicCard />
      ) : trackId ? (
        <GuidedPlayer trackId={trackId} paused={paused} />
      ) : podcastEpisodeId ? (
        <RuntimePodcastCard onChangePodcast={onChangePodcast} />
      ) : null}
    </section>
  );
}

function RuntimePodcastCard({ onChangePodcast }: { onChangePodcast?: () => void }) {
  const { podcast, audioPlaying, audioMuted, audioPosition, paused, togglePause, toggleAudioMute } = useWalkRuntime();
  if (!podcast) {
    return (
      <div className="rounded-2xl border border-forest/30 bg-card/80 p-4 text-center text-xs text-muted-foreground">
        Loading episode…
      </div>
    );
  }
  const dur = podcast.durationSeconds || 1;
  const pct = Math.min(100, (audioPosition / dur) * 100);
  const remain = Math.max(0, dur - audioPosition);
  const showingPlaying = audioPlaying && !paused;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-forest/30 bg-card/80 p-4 backdrop-blur">
      <div className="absolute inset-0 -z-10 opacity-40 gradient-warm" />
      <div className="flex items-center gap-3">
        <button
          onClick={togglePause}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-forest text-primary-foreground shadow-soft transition active:scale-95"
          aria-label={showingPlaying ? "Pause" : "Play"}
        >
          {showingPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-serif text-base leading-tight">{podcast.title}</div>
          {podcast.host && (
            <div className="truncate text-xs text-muted-foreground">{podcast.host}</div>
          )}
        </div>
        <button
          onClick={toggleAudioMute}
          className="rounded-full p-2 text-muted-foreground hover:text-forest"
          aria-label={audioMuted ? "Unmute" : "Mute"}
        >
          {audioMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
      <div className="mt-3">
        <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full bg-forest transition-all duration-1000" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>{fmt(audioPosition)}</span>
          <span>−{fmt(remain)}</span>
        </div>
      </div>
      {onChangePodcast && (
        <div className="mt-2 text-center">
          <button
            type="button"
            onClick={onChangePodcast}
            className="text-[11px] italic text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
          >
            Change episode
          </button>
        </div>
      )}
    </div>
  );
}

function RuntimeMusicCard() {
  const { music, audioPlaying, audioMuted, audioPosition, paused, togglePause, toggleAudioMute } = useWalkRuntime();
  if (!music || !music.current) {
    return (
      <div className="rounded-2xl border border-forest/30 bg-card/80 p-4 text-center text-xs text-muted-foreground">
        Loading music…
      </div>
    );
  }
  const t = music.current;
  const dur = t.duration_seconds || 1;
  const pct = Math.min(100, (audioPosition / dur) * 100);
  const remain = Math.max(0, dur - audioPosition);
  const showingPlaying = audioPlaying && !paused;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-forest/30 bg-card/80 p-4 backdrop-blur">
      <div className="absolute inset-0 -z-10 opacity-40 gradient-warm" />
      <div className="flex items-center gap-3">
        {t.cover_url ? (
          <img src={t.cover_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-border/60" />
        ) : null}
        <button
          onClick={togglePause}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-forest text-primary-foreground shadow-soft transition active:scale-95"
          aria-label={showingPlaying ? "Pause" : "Play"}
        >
          {showingPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-serif text-base leading-tight">{t.title}</div>
          <div className="truncate text-xs text-muted-foreground">
            {t.artist ?? music.label}
            {music.upNext ? <span className="opacity-60"> · next: {music.upNext.title}</span> : null}
          </div>
        </div>
        <button
          onClick={toggleAudioMute}
          className="rounded-full p-2 text-muted-foreground hover:text-forest"
          aria-label={audioMuted ? "Unmute" : "Mute"}
        >
          {audioMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
      <div className="mt-3">
        <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full bg-forest transition-all duration-1000" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>{fmt(audioPosition)}</span>
          <span>−{fmt(remain)}</span>
        </div>
      </div>
      {music.targetDurationSeconds ? (
        <div className="mt-2 text-center text-[11px] italic text-muted-foreground">
          {music.label} · auto-stops at end
        </div>
      ) : null}
    </div>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
