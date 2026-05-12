/**
 * Guided walk module — wraps the guided audio player.
 * Supports both `guided_tracks` (trackId) and `podcast_episodes` (podcastEpisodeId).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GuidedPlayer } from "@/components/guided-player";
import { SoloModule } from "./solo-module";

interface Props {
  trackId: string | null;
  podcastEpisodeId?: string | null;
  paused: boolean;
  intention: string | null;
  savedPrompts: string[];
  /** When set, render a small "Change episode" link below the podcast player. */
  onChangePodcast?: () => void;
}

interface EpisodeRow {
  id: string;
  title: string;
  audio_url: string;
  episode_url: string | null;
  duration_seconds: number;
  feed: { title: string; publisher: string | null } | null;
}

export function GuidedModule({ trackId, podcastEpisodeId, paused, intention, savedPrompts, onChangePodcast }: Props) {
  const [episode, setEpisode] = useState<EpisodeRow | null>(null);

  useEffect(() => {
    if (!podcastEpisodeId) { setEpisode(null); return; }
    supabase
      .from("podcast_episodes")
      .select("id,title,audio_url,episode_url,duration_seconds,feed:podcast_feeds(title,publisher)")
      .eq("id", podcastEpisodeId)
      .maybeSingle()
      .then(({ data }) => setEpisode(data as unknown as EpisodeRow | null));
  }, [podcastEpisodeId]);

  return (
    <section className="space-y-3">
      <SoloModule intention={intention} savedPrompts={savedPrompts} />
      {trackId ? (
        <GuidedPlayer trackId={trackId} paused={paused} />
      ) : episode ? (
        <>
          <GuidedPlayer
            paused={paused}
            autoStart
            sourceUrl={episode.episode_url}
            track={{
              id: episode.id,
              title: episode.title,
              host: episode.feed?.publisher ?? episode.feed?.title ?? null,
              host_role: episode.feed?.title ?? null,
              audio_url: episode.audio_url,
              generative_key: null,
              duration_seconds: episode.duration_seconds,
            }}
          />
          {onChangePodcast && (
            <div className="text-center">
              <button
                type="button"
                onClick={onChangePodcast}
                className="text-[11px] italic text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
              >
                Change episode
              </button>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
