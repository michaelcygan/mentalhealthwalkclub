import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ExternalLink, Star } from "lucide-react";

export const Route = createFileRoute("/admin/podcasts/$feedId")({ component: AdminFeedEpisodes });

interface Episode {
  id: string;
  title: string;
  episode_url: string | null;
  duration_seconds: number;
  published_at: string | null;
  is_active: boolean;
  is_featured: boolean;
  mood_tags: string[];
  walk_fit_score: number;
}

const MOODS = ["calm", "anxious", "lonely", "hopeful", "reflective", "body", "relationships", "grief", "stress", "sleep"];

function AdminFeedEpisodes() {
  const { feedId } = Route.useParams();
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [feedTitle, setFeedTitle] = useState("");

  const load = async () => {
    const [{ data: f }, { data: eps }] = await Promise.all([
      supabase.from("podcast_feeds").select("title").eq("id", feedId).maybeSingle(),
      supabase.from("podcast_episodes").select("*").eq("feed_id", feedId).order("published_at", { ascending: false }).limit(100),
    ]);
    setFeedTitle(f?.title ?? "");
    setEpisodes((eps ?? []) as Episode[]);
  };
  useEffect(() => { load(); }, [feedId]);

  const update = async (id: string, patch: Partial<Episode>) => {
    setEpisodes((prev) => prev?.map((e) => (e.id === id ? { ...e, ...patch } : e)) ?? null);
    await supabase.from("podcast_episodes").update(patch).eq("id", id);
  };

  const toggleMood = (e: Episode, mood: string) => {
    const next = e.mood_tags.includes(mood) ? e.mood_tags.filter((m) => m !== mood) : [...e.mood_tags, mood];
    update(e.id, { mood_tags: next });
  };

  return (
    <div className="space-y-4">
      <Link to="/admin/podcasts" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3.5 w-3.5" /> All feeds
      </Link>
      <h2 className="font-serif text-xl">{feedTitle}</h2>
      {episodes === null ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : episodes.length === 0 ? (
        <div className="text-sm text-muted-foreground">No episodes yet — sync the feed first.</div>
      ) : (
        <div className="space-y-2">
          {episodes.map((e) => (
            <div key={e.id} className="rounded-2xl border border-border bg-card p-3 space-y-2">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-serif text-sm">{e.title}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {e.published_at ? new Date(e.published_at).toLocaleDateString() : "—"} · {Math.round(e.duration_seconds / 60)} min
                    {e.episode_url && <a href={e.episode_url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-0.5 hover:text-foreground"><ExternalLink className="h-3 w-3" /> source</a>}
                  </div>
                </div>
                <button onClick={() => update(e.id, { is_featured: !e.is_featured })} aria-label="Featured">
                  <Star className={`h-4 w-4 ${e.is_featured ? "fill-clay text-clay" : "text-muted-foreground"}`} />
                </button>
                <Switch checked={e.is_active} onCheckedChange={(v) => update(e.id, { is_active: v })} />
              </div>
              <div className="flex flex-wrap gap-1">
                {MOODS.map((m) => {
                  const on = e.mood_tags.includes(m);
                  return (
                    <button
                      key={m}
                      onClick={() => toggleMood(e, m)}
                      className={`rounded-full border px-2 py-0.5 text-[10px] ${on ? "border-forest bg-forest text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>Walk fit</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={e.walk_fit_score}
                  onChange={(ev) => update(e.id, { walk_fit_score: Number(ev.target.value) })}
                  className="flex-1"
                />
                <span className="w-4 text-right tabular-nums text-foreground">{e.walk_fit_score}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
