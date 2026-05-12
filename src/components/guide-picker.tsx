import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AmbientPad } from "@/lib/audio/ambient-pad";
import { Play, Pause, Sparkles, Wind, Mic, Music, Headphones, ChevronLeft, Shuffle, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface AmbientTrackMeta {
  id: string;
  title: string;
  artist: string | null;
  genre: string | null;
  audio_path: string;
  cover_url: string | null;
  duration_seconds: number;
  mood_tags: string[];
  is_featured: boolean;
}

export interface MusicPlaylistChoice {
  kind: "music_playlist";
  tracks: AmbientTrackMeta[];
  /** Stop queue once cumulative play time crosses this; null = loop forever. */
  targetDurationSeconds: number | null;
  label: string;
}

export interface GuidedTrack {
  id: string;
  title: string;
  host: string | null;
  host_role: string | null;
  duration_seconds: number;
  audio_url: string | null;
  cover_url: string | null;
  mood_tags: string[];
  category: string;
  generative_key: string | null;
  /** Set when this "track" is actually a podcast episode. */
  podcast_episode_id?: string;
  /** Original publisher episode page URL (for attribution). */
  episode_url?: string | null;
  /** Set when this is a single ambient music track (real audio, not a pad). */
  ambient_track?: AmbientTrackMeta;
  /** Set when the user picked a Timed Mix or Shuffle. */
  music_playlist?: MusicPlaylistChoice;
}

// NOTE: Re-enable this chip strip once breath / voice / music sub-categories
// have content. For now we only have ambient music.
const VOICE_CATS: Array<{ k: string; label: string; icon: typeof Sparkles }> = [
  { k: "ambient", label: "Ambient", icon: Sparkles },
  { k: "breath", label: "Breath", icon: Wind },
  { k: "voice", label: "Voice", icon: Mic },
  { k: "music", label: "Music", icon: Music },
];

const POD_CATS: Array<{ k: string; label: string }> = [
  { k: "calm_down", label: "Calm Down" },
  { k: "think_clearly", label: "Think Clearly" },
  { k: "feel_connected", label: "Feel Connected" },
  { k: "walk_with_hope", label: "Walk With Hope" },
  { k: "body_brain", label: "Body & Brain" },
  { k: "relationships", label: "Relationships" },
];

interface PodcastFeed {
  id: string;
  title: string;
  publisher: string | null;
  credibility: string;
  image_url: string | null;
  description: string | null;
}

interface PodcastEpisode {
  id: string;
  title: string;
  description: string | null;
  audio_url: string;
  episode_url: string | null;
  image_url: string | null;
  duration_seconds: number;
  mood_tags: string[];
  walk_fit_score: number;
  feed: { title: string; publisher: string | null; credibility: string; image_url: string | null } | null;
}

interface Props {
  mood: string | null;
  onChoose: (track: GuidedTrack) => void;
  onSkip: () => void;
}

/** Reusable podcast browser — used inside the composer and the in-walk sheet. */
export function PodcastBrowser({ mood, onChoose }: { mood: string | null; onChoose: (t: GuidedTrack) => void }) {
  const [feeds, setFeeds] = useState<PodcastFeed[] | null>(null);
  const [activeFeed, setActiveFeed] = useState<PodcastFeed | null>(null);
  const [episodes, setEpisodes] = useState<PodcastEpisode[] | null>(null);

  useEffect(() => {
    setActiveFeed(null);
    setFeeds(null);
    supabase
      .from("podcast_feeds")
      .select("id,title,publisher,credibility,image_url,description")
      .eq("is_active", true)
      .order("title")
      .then(({ data }) => {
        const rows = (data ?? []) as unknown as PodcastFeed[];
        // Stable shuffle per mount for discoverability
        for (let i = rows.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [rows[i], rows[j]] = [rows[j], rows[i]];
        }
        setFeeds(rows);
      });
  }, []);

  useEffect(() => {
    if (!activeFeed) { setEpisodes(null); return; }
    setEpisodes(null);
    supabase
      .from("podcast_episodes")
      .select("id,title,description,audio_url,episode_url,image_url,duration_seconds,mood_tags,walk_fit_score,feed:podcast_feeds!inner(title,publisher,credibility,image_url)")
      .eq("is_active", true)
      .eq("feed_id", activeFeed.id)
      .order("published_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setEpisodes((data ?? []) as unknown as PodcastEpisode[]));
  }, [activeFeed]);

  const choose = (e: PodcastEpisode) => {
    onChoose({
      id: e.id,
      title: e.title,
      host: e.feed?.publisher ?? e.feed?.title ?? null,
      host_role: e.feed?.title ?? null,
      duration_seconds: e.duration_seconds,
      audio_url: e.audio_url,
      cover_url: e.image_url ?? e.feed?.image_url ?? null,
      mood_tags: e.mood_tags,
      category: "podcast",
      generative_key: null,
      podcast_episode_id: e.id,
      episode_url: e.episode_url,
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs italic text-muted-foreground">Curated for reflection while you walk.</p>

      {activeFeed ? (
        <div className="space-y-3">
          <button
            onClick={() => setActiveFeed(null)}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> All shows
          </button>
          <div className="flex gap-3 rounded-2xl border border-border bg-gradient-to-br from-card to-secondary/30 p-3 shadow-soft">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary/60 shadow-sm ring-1 ring-border/60">
              {activeFeed.image_url && <img src={activeFeed.image_url} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-serif text-lg leading-tight">{activeFeed.title}</div>
              <div className="mt-0.5 truncate text-[11px] uppercase tracking-wider text-forest/80">
                {activeFeed.publisher ?? "Podcast"}
                {episodes && episodes.length > 0 ? ` · ${episodes.length} episode${episodes.length === 1 ? "" : "s"}` : ""}
              </div>
              {activeFeed.description && (
                <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
                  {activeFeed.description}
                </p>
              )}
            </div>
          </div>
          <div className="px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Episodes
          </div>

          {episodes === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-secondary/60" />)}
            </div>
          ) : episodes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm italic text-muted-foreground">No episodes synced yet.</div>
          ) : (
            <div className="grid gap-3">
              {episodes.map((e) => {
                const matches = mood ? e.mood_tags.includes(mood) : false;
                const cover = e.image_url ?? e.feed?.image_url ?? activeFeed.image_url;
                return (
                  <button key={e.id} onClick={() => choose(e)} className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-3 text-left transition hover:-translate-y-px hover:border-forest/50 hover:shadow-soft">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-secondary/60">
                      {cover && <img src={cover} alt="" className="h-full w-full object-contain" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="line-clamp-2 font-serif text-base leading-tight">{e.title}</div>
                        {matches && <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-forest">fits</span>}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {Math.round(e.duration_seconds / 60) || "—"} min
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : feeds === null ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="aspect-square animate-pulse rounded-2xl bg-secondary/60" />)}
        </div>
      ) : feeds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm italic text-muted-foreground">No shows here yet — try another category.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {feeds.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFeed(f)}
              className="group flex flex-col gap-2 rounded-2xl border border-border bg-card p-2.5 text-left transition hover:-translate-y-px hover:border-forest/50 hover:shadow-soft"
            >
              <div className="aspect-square w-full overflow-hidden rounded-xl bg-secondary/60">
                {f.image_url && <img src={f.image_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 px-0.5">
                <div className="truncate font-serif text-sm leading-tight">{f.title}</div>
                <div className="truncate text-[10px] text-muted-foreground">{f.publisher ?? "Podcast"}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      <p className="text-center text-[10px] italic text-muted-foreground">
        Curated audio for reflection — not a substitute for professional care.
      </p>
    </div>
  );
}

interface AmbientRow {
  id: string;
  title: string;
  artist: string | null;
  genre: string | null;
  audio_path: string;
  cover_path: string | null;
  duration_seconds: number;
  mood_tags: string[];
  is_featured: boolean;
  sort_order: number;
}

function rowToMeta(r: AmbientRow): AmbientTrackMeta {
  const cover_url = r.cover_path
    ? supabase.storage.from("ambient-covers").getPublicUrl(r.cover_path).data.publicUrl
    : null;
  return {
    id: r.id,
    title: r.title,
    artist: r.artist,
    genre: r.genre,
    audio_path: r.audio_path,
    cover_url,
    duration_seconds: r.duration_seconds,
    mood_tags: r.mood_tags ?? [],
    is_featured: r.is_featured,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build a shuffled queue that fills target seconds (allow last track to slightly overshoot). */
function buildTimedQueue(tracks: AmbientTrackMeta[], targetSec: number): AmbientTrackMeta[] {
  const pool = shuffle(tracks);
  if (pool.length === 0) return [];
  const queue: AmbientTrackMeta[] = [];
  let total = 0;
  let i = 0;
  while (total < targetSec) {
    const t = pool[i % pool.length];
    queue.push(t);
    total += t.duration_seconds || 0;
    i++;
    if (i > pool.length * 6) break; // safety
  }
  return queue;
}

const MIX_OPTIONS = [
  { label: "15 min", seconds: 15 * 60 },
  { label: "30 min", seconds: 30 * 60 },
  { label: "60 min", seconds: 60 * 60 },
];

export function GuidePicker({ mood, onChoose, onSkip }: Props) {
  const [tab, setTab] = useState<"music" | "podcast">("music");
  const [music, setMusic] = useState<AmbientTrackMeta[] | null>(null);

  useEffect(() => {
    supabase.from("ambient_tracks")
      .select("id,title,artist,genre,audio_path,cover_path,duration_seconds,mood_tags,is_featured,sort_order")
      .eq("is_active", true)
      .order("is_featured", { ascending: false })
      .order("sort_order")
      .order("created_at", { ascending: false })
      .then(({ data }) => setMusic(((data ?? []) as AmbientRow[]).map(rowToMeta)));
  }, []);

  const sortedMusic = useMemo(() => {
    if (!music) return null;
    if (!mood) return music;
    return music.slice().sort((a, b) => {
      const am = a.mood_tags.includes(mood) ? -1 : 0;
      const bm = b.mood_tags.includes(mood) ? -1 : 0;
      return am - bm;
    });
  }, [music, mood]);

  const pickSingle = (t: AmbientTrackMeta) => {
    onChoose({
      id: t.id,
      title: t.title,
      host: t.artist,
      host_role: t.genre,
      duration_seconds: t.duration_seconds,
      audio_url: null,
      cover_url: t.cover_url,
      mood_tags: t.mood_tags,
      category: "music",
      generative_key: null,
      ambient_track: t,
    });
  };

  const pickMix = (seconds: number, label: string) => {
    if (!sortedMusic || sortedMusic.length === 0) return;
    const queue = buildTimedQueue(sortedMusic, seconds);
    const first = queue[0];
    onChoose({
      id: `mix-${seconds}`,
      title: `${label} mix`,
      host: "Shuffled music",
      host_role: null,
      duration_seconds: seconds,
      audio_url: null,
      cover_url: first?.cover_url ?? null,
      mood_tags: [],
      category: "music",
      generative_key: null,
      music_playlist: { kind: "music_playlist", tracks: queue, targetDurationSeconds: seconds, label: `${label} mix` },
    });
  };

  const pickShuffleAll = () => {
    if (!sortedMusic || sortedMusic.length === 0) return;
    const queue = shuffle(sortedMusic);
    const first = queue[0];
    onChoose({
      id: "shuffle-all",
      title: "Shuffle all",
      host: "Music library",
      host_role: null,
      duration_seconds: 0,
      audio_url: null,
      cover_url: first?.cover_url ?? null,
      mood_tags: [],
      category: "music",
      generative_key: null,
      music_playlist: { kind: "music_playlist", tracks: queue, targetDurationSeconds: null, label: "Shuffle" },
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-3xl leading-tight">Choose your guide</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {tab === "music"
            ? (mood ? <>Music to match <span className="text-foreground">{mood}</span>.</> : "Music for your walk.")
            : (mood ? <>Suited to <span className="text-foreground">{mood}</span>.</> : "A gentle voice in your ear.")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-1">
        <button
          onClick={() => setTab("music")}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition ${tab === "music" ? "bg-forest text-primary-foreground shadow-soft" : "text-muted-foreground"}`}
        >
          <Music className="h-4 w-4" /> Music
        </button>
        <button
          onClick={() => setTab("podcast")}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition ${tab === "podcast" ? "bg-forest text-primary-foreground shadow-soft" : "text-muted-foreground"}`}
        >
          <Headphones className="h-4 w-4" /> Podcast
        </button>
      </div>

      {tab === "music" ? (
        <MusicTab
          tracks={sortedMusic}
          mood={mood}
          onPickTrack={pickSingle}
          onPickMix={pickMix}
          onShuffleAll={pickShuffleAll}
        />
      ) : (
        <PodcastBrowser mood={mood} onChoose={onChoose} />
      )}

      <Button variant="ghost" onClick={onSkip} className="w-full rounded-full text-muted-foreground">No guide — just walk</Button>
    </div>
  );
}

function MusicTab({ tracks, mood, onPickTrack, onPickMix, onShuffleAll }: {
  tracks: AmbientTrackMeta[] | null;
  mood: string | null;
  onPickTrack: (t: AmbientTrackMeta) => void;
  onPickMix: (sec: number, label: string) => void;
  onShuffleAll: () => void;
}) {
  if (tracks === null) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-secondary/60" />)}
        </div>
        {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-secondary/60" />)}
      </div>
    );
  }
  if (tracks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm italic text-muted-foreground">
        Music is being added — check back soon.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Timed mixes */}
      <div>
        <div className="mb-2 px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Timed mix · auto-stops when your time's up
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MIX_OPTIONS.map(({ label, seconds }) => (
            <button
              key={seconds}
              onClick={() => onPickMix(seconds, label)}
              className="group relative flex flex-col items-start gap-1 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card to-secondary/40 p-3 text-left shadow-soft transition hover:-translate-y-px hover:border-forest/50"
            >
              <Clock className="h-4 w-4 text-forest" />
              <div className="font-serif text-lg leading-none">{label}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">walk</div>
            </button>
          ))}
        </div>
      </div>

      {/* Shuffle pill */}
      <div className="flex items-center gap-2">
        <button
          onClick={onShuffleAll}
          className="inline-flex items-center gap-1.5 rounded-full border border-forest/40 bg-accent/40 px-3 py-1.5 text-xs font-medium text-forest transition hover:bg-accent/70"
        >
          <Shuffle className="h-3.5 w-3.5" /> Shuffle all
        </button>
        <span className="text-[10px] text-muted-foreground">{tracks.length} track{tracks.length === 1 ? "" : "s"}</span>
      </div>

      {/* Track list */}
      <div className="grid gap-2">
        {tracks.map((t) => {
          const matches = mood ? t.mood_tags.includes(mood) : false;
          return (
            <button
              key={t.id}
              onClick={() => onPickTrack(t)}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5 text-left transition hover:-translate-y-px hover:border-forest/50 hover:shadow-soft"
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl gradient-forest">
                {t.cover_url && <img src={t.cover_url} alt="" className="h-full w-full object-cover" />}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-primary-foreground opacity-0 transition group-hover:opacity-100">
                  <Play className="h-5 w-5" />
                </div>
                {t.is_featured && (
                  <div className="absolute right-0 top-0 rounded-bl-md bg-amber-500/90 p-0.5 text-white">
                    <Star className="h-2.5 w-2.5 fill-current" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate font-serif text-base leading-tight">{t.title}</div>
                  {matches && <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-forest">fits</span>}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {[t.artist, t.genre].filter(Boolean).join(" · ") || "Ambient"} · {Math.round((t.duration_seconds || 0) / 60) || "—"} min
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

