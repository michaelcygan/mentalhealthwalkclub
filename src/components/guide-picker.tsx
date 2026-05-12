import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AmbientPad } from "@/lib/audio/ambient-pad";
import { Play, Pause, Sparkles, Wind, Mic, Music, Headphones, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

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
}

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
  const [podCat, setPodCat] = useState<string>("calm_down");
  const [episodes, setEpisodes] = useState<PodcastEpisode[] | null>(null);

  useEffect(() => {
    setEpisodes(null);
    supabase
      .from("podcast_episodes")
      .select("id,title,description,audio_url,episode_url,image_url,duration_seconds,mood_tags,walk_fit_score,feed:podcast_feeds!inner(title,publisher,credibility,image_url,category,is_active)")
      .eq("is_active", true)
      .eq("feed.is_active", true)
      .eq("feed.category", podCat)
      .order("walk_fit_score", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(30)
      .then(({ data }) => setEpisodes((data ?? []) as unknown as PodcastEpisode[]));
  }, [podCat]);

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
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {POD_CATS.map(({ k, label }) => (
          <button
            key={k}
            onClick={() => setPodCat(k)}
            className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-[11px] transition ${podCat === k ? "border-forest bg-accent/60 text-forest" : "border-border bg-card text-muted-foreground hover:border-forest/40"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {episodes === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-secondary/60" />)}
        </div>
      ) : episodes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm italic text-muted-foreground">No episodes here yet — try another category.</div>
      ) : (
        <div className="grid gap-3">
          {episodes.map((e) => {
            const matches = mood ? e.mood_tags.includes(mood) : false;
            return (
              <button key={e.id} onClick={() => choose(e)} className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-3 text-left transition hover:-translate-y-px hover:border-forest/50 hover:shadow-soft">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl gradient-forest">
                  {(e.image_url ?? e.feed?.image_url) && <img src={(e.image_url ?? e.feed?.image_url) as string} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-serif text-base leading-tight">{e.title}</div>
                    {matches && <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-forest">fits</span>}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {e.feed?.publisher ?? e.feed?.title ?? "Podcast"} · {Math.round(e.duration_seconds / 60) || "—"} min
                    {e.feed?.credibility && <span className="ml-1 text-muted-foreground/70">· {e.feed.credibility.replace(/_/g, " ")}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      <p className="text-center text-[10px] italic text-muted-foreground">
        Curated audio for reflection — not a substitute for professional care.
      </p>
    </div>
  );
}

export function GuidePicker({ mood, onChoose, onSkip }: Props) {
  const [tab, setTab] = useState<"voice" | "podcast">("voice");
  const [tracks, setTracks] = useState<GuidedTrack[]>([]);
  const [cat, setCat] = useState<string>("ambient");
  const [previewing, setPreviewing] = useState<string | null>(null);
  const padRef = useRef<AmbientPad | null>(null);
  const stopRef = useRef<number | null>(null);

  useEffect(() => {
    supabase.from("guided_tracks").select("*").eq("is_active", true).order("sort_order")
      .then(({ data }) => setTracks((data ?? []) as GuidedTrack[]));
    return () => { padRef.current?.stop(); if (stopRef.current) clearTimeout(stopRef.current); };
  }, []);

  const filtered = tracks
    .filter((t) => t.category === cat)
    .sort((a, b) => {
      if (!mood) return 0;
      const am = a.mood_tags.includes(mood) ? -1 : 0;
      const bm = b.mood_tags.includes(mood) ? -1 : 0;
      return am - bm;
    });

  const togglePreview = async (t: GuidedTrack) => {
    if (previewing === t.id) {
      await padRef.current?.stop(); padRef.current = null;
      if (stopRef.current) { clearTimeout(stopRef.current); stopRef.current = null; }
      setPreviewing(null); return;
    }
    await padRef.current?.stop();
    if (t.generative_key) {
      padRef.current = new AmbientPad();
      await padRef.current.start(0.14, t.generative_key);
    }
    setPreviewing(t.id);
    if (stopRef.current) clearTimeout(stopRef.current);
    stopRef.current = window.setTimeout(async () => {
      await padRef.current?.stop(); padRef.current = null;
      setPreviewing(null);
    }, 15000);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-3xl leading-tight">Choose your guide</h2>
        <p className="mt-1 text-sm text-muted-foreground">{mood ? <>Suited to <span className="text-foreground">{mood}</span>.</> : "A gentle voice in your ear."}</p>
      </div>

      {/* Top-level tabs: Voice vs Podcast — equal weight */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-1">
        <button
          onClick={() => setTab("voice")}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition ${tab === "voice" ? "bg-forest text-primary-foreground shadow-soft" : "text-muted-foreground"}`}
        >
          <Mic className="h-4 w-4" /> Voice guide
        </button>
        <button
          onClick={() => setTab("podcast")}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition ${tab === "podcast" ? "bg-forest text-primary-foreground shadow-soft" : "text-muted-foreground"}`}
        >
          <Headphones className="h-4 w-4" /> Podcast
        </button>
      </div>

      {tab === "voice" ? (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {VOICE_CATS.map(({ k, label, icon: Icon }) => (
              <button key={k} onClick={() => setCat(k)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${cat === k ? "border-forest bg-accent/60 text-forest" : "border-border bg-card text-foreground hover:border-forest/40"}`}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm italic text-muted-foreground">More {cat} guides coming soon. Try ambient for now.</div>
          ) : (
            <div className="grid gap-3">
              {filtered.map((t) => {
                const matches = mood ? t.mood_tags.includes(mood) : false;
                return (
                  <button key={t.id} onClick={() => onChoose(t)} className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-3 text-left transition hover:-translate-y-px hover:border-forest/50 hover:shadow-soft">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl gradient-forest">
                      {t.cover_url && <img src={t.cover_url} alt="" className="h-full w-full object-cover" />}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); togglePreview(t); }}
                        className="absolute inset-0 flex items-center justify-center bg-black/25 text-primary-foreground opacity-0 transition group-hover:opacity-100 data-[on=true]:opacity-100"
                        data-on={previewing === t.id}
                        aria-label="Preview"
                      >
                        {previewing === t.id ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-serif text-lg leading-tight">{t.title}</div>
                        {matches && <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-forest">fits</span>}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{t.host}{t.host_role ? ` · ${t.host_role}` : ""} · {Math.round(t.duration_seconds / 60)} min</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <PodcastBrowser mood={mood} onChoose={onChoose} />
      )}

      <Button variant="ghost" onClick={onSkip} className="w-full rounded-full text-muted-foreground">No guide — just walk</Button>
    </div>
  );
}
