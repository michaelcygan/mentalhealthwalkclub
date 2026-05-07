import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AmbientPad } from "@/lib/audio/ambient-pad";
import { Play, Pause, Sparkles, Wind, Mic, Music } from "lucide-react";
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
}

const CATS: Array<{ k: string; label: string; icon: typeof Sparkles }> = [
  { k: "ambient", label: "Ambient", icon: Sparkles },
  { k: "breath", label: "Breath", icon: Wind },
  { k: "voice", label: "Voice", icon: Mic },
  { k: "music", label: "Music", icon: Music },
];

interface Props {
  mood: string | null;
  onChoose: (track: GuidedTrack) => void;
  onSkip: () => void;
}

export function GuidePicker({ mood, onChoose, onSkip }: Props) {
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

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {CATS.map(({ k, label, icon: Icon }) => (
          <button key={k} onClick={() => setCat(k)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${cat === k ? "border-forest bg-forest text-primary-foreground" : "border-border bg-card text-foreground hover:border-forest/40"}`}>
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

      <Button variant="ghost" onClick={onSkip} className="w-full rounded-full text-muted-foreground">No guide — just walk</Button>
    </div>
  );
}
