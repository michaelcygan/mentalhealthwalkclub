import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Footprints, Play, Square, Camera, Pause, ArrowLeft, Sparkles, Activity, X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AudioSourcePicker, type AudioSource } from "@/components/audio/audio-source-picker";
import { useAmbient } from "@/lib/ambient-context";
import { useStepCounter } from "@/hooks/use-step-counter";
import { useGeolocation, useCurrentWeather } from "@/hooks/use-weather";
import WalkWeather from "@/components/walk-page/walk-weather";
import { listMyPlaylists, getPlaylist, listenCatalog } from "@/lib/playlists.functions";
import { PROMPTS, moodToFamily, type ReflectionPrompt } from "@/lib/reflection-prompts";
import { compressImage } from "@/lib/image-compress";

export const Route = createFileRoute("/_authenticated/walk/")({
  component: SoloWalkPage,
  head: () => ({
    meta: [
      { title: "Solo walk — Mental Health Walk Club" },
      { name: "description", content: "A quiet timer, weather, mood, and a journal. No tracking, no pressure." },
    ],
  }),
});

const MOODS = ["heavy", "anxious", "okay", "steady", "hopeful", "grateful"];

type Stage = "pre" | "active" | "post";

function fmtClock(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function SoloWalkPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stage, setStage] = useState<Stage>("pre");
  const [walkId, setWalkId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedAccum = useRef(0);
  const pausedAt = useRef<number | null>(null);

  const [moodBefore, setMoodBefore] = useState<string | null>(null);
  const [moodAfter, setMoodAfter] = useState<string | null>(null);
  const [intention, setIntention] = useState("");
  const [note, setNote] = useState("");
  const [source, setSource] = useState<AudioSource>({ kind: "silence" });

  const [playlists, setPlaylists] = useState<{ id: string; name: string }[]>([]);
  const [podcasts, setPodcasts] = useState<{ id: string; title: string }[]>([]);

  const { coords } = useGeolocation({ autoRequest: false, ipFallback: true });
  const { data: weather } = useCurrentWeather(coords);

  const ambient = useAmbient();
  const stepCounter = useStepCounter(stage === "active" && !paused);

  // Load picker options
  useEffect(() => {
    listMyPlaylists().then((r) => setPlaylists(r.playlists.map((p) => ({ id: p.id, name: p.name }))));
    listenCatalog().then((c) => setPodcasts(c.podcasts.map((p: { id: string; title: string }) => ({ id: p.id, title: p.title }))));
  }, []);

  // Timer tick
  useEffect(() => {
    if (stage !== "active" || paused || startedAt == null) return;
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt - pausedAccum.current) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [stage, paused, startedAt]);

  // Podcast / playlist audio (simple sequential <audio>)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<string[]>([]); // array of audio URLs
  const [queueIdx, setQueueIdx] = useState(0);

  useEffect(() => {
    if (stage !== "active") return;
    let cancelled = false;
    (async () => {
      if (source.kind === "podcast_episode") {
        const { data } = await supabase
          .from("podcast_episodes")
          .select("audio_url")
          .eq("id", source.track_id)
          .maybeSingle();
        if (!cancelled && data?.audio_url) { setQueue([data.audio_url]); setQueueIdx(0); }
      } else if (source.kind === "playlist") {
        const r = await getPlaylist({ data: { id: source.playlist_id } });
        const urls: string[] = [];
        for (const it of r.items) {
          if (it.kind === "podcast_episode") {
            const { data } = await supabase.from("podcast_episodes").select("audio_url").eq("id", it.track_id).maybeSingle();
            if (data?.audio_url) urls.push(data.audio_url);
          } else if (it.kind === "ambient_track") {
            const { data: tr } = await supabase.from("ambient_tracks").select("audio_path").eq("id", it.track_id).maybeSingle();
            if (tr?.audio_path) {
              const { data: signed } = await supabase.storage.from("ambient-music").createSignedUrl(tr.audio_path, 7200);
              if (signed?.signedUrl) urls.push(signed.signedUrl);
            }
          } else if (it.kind === "guided_track") {
            const { data } = await supabase.from("guided_tracks").select("audio_url").eq("id", it.track_id).maybeSingle();
            if (data?.audio_url) urls.push(data.audio_url);
          }
        }
        if (!cancelled) { setQueue(urls); setQueueIdx(0); }
      }
    })();
    return () => { cancelled = true; };
  }, [stage, source]);

  // Play queue
  useEffect(() => {
    if (stage !== "active") return;
    if (source.kind !== "podcast_episode" && source.kind !== "playlist") return;
    if (queue.length === 0) return;
    const el = audioRef.current;
    if (!el) return;
    el.src = queue[queueIdx] ?? "";
    if (!paused) el.play().catch(() => {});
  }, [queue, queueIdx, source.kind, stage, paused]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (paused) el.pause(); else el.play().catch(() => {});
  }, [paused]);

  async function start() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("walk_sessions")
        .insert({
          user_id: user.id,
          walk_type: "solo",
          status: "active",
          mood_before: moodBefore ?? null,
          intention: intention.trim() || null,
          podcast_episode_id: source.kind === "podcast_episode" ? source.track_id : null,
        })
        .select("id")
        .single();
      if (error) throw error;
      setWalkId(data.id);
      setStartedAt(Date.now());
      pausedAccum.current = 0;
      pausedAt.current = null;
      setElapsed(0);
      setStage("active");
      if (source.kind === "ambient") await ambient.start();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function togglePause() {
    setPaused((p) => {
      if (p) {
        // resuming
        if (pausedAt.current != null) pausedAccum.current += Date.now() - pausedAt.current;
        pausedAt.current = null;
        return false;
      }
      pausedAt.current = Date.now();
      return true;
    });
  }

  async function endWalk() {
    setStage("post");
    if (source.kind === "ambient") ambient.stop(400);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
  }

  async function savePost() {
    if (!walkId) return;
    try {
      const { error } = await supabase
        .from("walk_sessions")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
          duration_seconds: elapsed,
          steps: stepCounter.steps || null,
          mood_after: moodAfter ?? null,
          reflection_note: note.trim() || null,
          weather_at_end: weather ? { tempF: weather.tempF, label: weather.label, code: weather.code } : null,
        })
        .eq("id", walkId);
      if (error) throw error;
      toast.success("Walk saved");
      navigate({ to: "/journal" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function onPhotoPicked(rawFile: File) {
    if (!walkId || !user) return;
    const file = await compressImage(rawFile);
    const ext = file.name.split(".").pop() || "webp";
    const path = `${user.id}/${walkId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("walk-photos").upload(path, file, { upsert: false, contentType: file.type });
    if (upErr) { toast.error(upErr.message); return; }
    const { error } = await supabase.from("walk_photos").insert({
      walk_session_id: walkId,
      user_id: user.id,
      storage_path: path,
      taken_at_seconds: elapsed,
    });
    if (error) toast.error(error.message);
    else toast.success("Snapshot saved");
  }

  // Reflection prompt for the post stage
  const reflectionPrompt: ReflectionPrompt | null = useMemo(() => {
    if (stage !== "post") return null;
    const family = moodToFamily(moodBefore);
    const pool = PROMPTS.filter((p) => p.family === family || p.family === "universal");
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }, [stage, moodBefore]);

  if (stage === "pre") {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <Link to="/" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back
        </Link>
        <header className="mb-6">
          <h1 className="flex items-center gap-2 font-serif text-3xl">
            <Footprints className="h-6 w-6 text-forest" /> Walk solo
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">A timer, weather, mood, and a journal. No tracking, no pressure.</p>
        </header>

        <Section title="How are you arriving?">
          <MoodGrid value={moodBefore} onChange={setMoodBefore} />
        </Section>

        <Section title="Anything on your mind? (optional)">
          <Textarea
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            placeholder="An intention, a question, a feeling…"
            rows={2}
            maxLength={240}
            className="rounded-2xl"
          />
        </Section>

        <Section title="What do you want to hear?">
          <AudioSourcePicker value={source} onChange={setSource} playlists={playlists} podcasts={podcasts} />
        </Section>

        {coords && (
          <Section title="Weather">
            <WalkWeather lat={coords.lat} lng={coords.lng} centerIso={new Date().toISOString()} />
          </Section>
        )}

        {stepCounter.permissionState === "needed" && (
          <p className="mb-4 rounded-2xl border border-dashed border-border bg-card/60 p-3 text-xs text-muted-foreground">
            <Button size="sm" variant="ghost" onClick={() => stepCounter.request()} className="px-2 underline">Enable motion</Button> for step counting (optional).
          </p>
        )}

        <Button onClick={start} size="lg" className="h-14 w-full rounded-2xl">
          <Play className="mr-2 h-5 w-5" /> Start walking
        </Button>
      </div>
    );
  }

  if (stage === "active") {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-32 pt-6">
        <header className="mb-6 text-center">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{paused ? "Paused" : "Walking"}</p>
          <div className="mt-2 font-serif text-6xl tabular-nums">{fmtClock(elapsed)}</div>
          {stepCounter.permissionState === "granted" && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Activity className="h-3 w-3" /> {stepCounter.steps} steps
            </p>
          )}
        </header>

        {weather && (
          <div className="mb-6 text-center text-sm text-muted-foreground">
            {weather.tempF}° · {weather.label}
          </div>
        )}

        {intention && (
          <blockquote className="mb-6 rounded-3xl border border-border bg-card p-4 text-center font-serif text-sm italic text-muted-foreground">
            "{intention}"
          </blockquote>
        )}

        {/* hidden audio element for podcast/playlist */}
        <audio
          ref={audioRef}
          onEnded={() => setQueueIdx((i) => Math.min(i + 1, queue.length))}
          className="hidden"
        />

        {source.kind === "ambient" && ambient.current && (
          <div className="mb-6 rounded-3xl border border-border bg-card p-4 text-center text-xs text-muted-foreground">
            ♪ {ambient.current.title}
            <button onClick={ambient.skip} className="ml-2 underline">skip</button>
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          <Button onClick={togglePause} variant="outline" size="lg" className="h-14 w-14 rounded-full p-0">
            {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </Button>
          <Button onClick={endWalk} size="lg" className="h-14 rounded-full px-6">
            <Square className="mr-2 h-4 w-4" /> End walk
          </Button>
        </div>

        {/* Camera FAB */}
        <label className="fixed bottom-24 right-6 z-40 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-forest text-primary-foreground shadow-soft">
          <Camera className="h-5 w-5" />
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhotoPicked(f); e.currentTarget.value = ""; }}
          />
        </label>
      </div>
    );
  }

  // post
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">You walked</p>
        <h1 className="mt-1 font-serif text-3xl">{fmtClock(elapsed)}
          {stepCounter.steps > 0 && <span className="ml-3 text-base text-muted-foreground">· {stepCounter.steps} steps</span>}
        </h1>
      </header>

      <Section title="How are you leaving?">
        <MoodGrid value={moodAfter} onChange={setMoodAfter} />
      </Section>

      {reflectionPrompt && (
        <div className="mb-4 rounded-3xl border border-border bg-card p-4 shadow-soft">
          <p className="mb-2 inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <Sparkles className="h-3 w-3" /> A prompt
          </p>
          <p className="font-serif text-base italic">{reflectionPrompt.text}</p>
        </div>
      )}

      <Section title="Journal (optional)">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What's worth keeping from this walk?"
          rows={5}
          maxLength={2000}
          className="rounded-2xl"
        />
      </Section>

      <div className="flex gap-2">
        <Button onClick={() => { setStage("pre"); setWalkId(null); }} variant="outline" className="flex-1 rounded-full">
          <X className="mr-1 h-4 w-4" /> Discard
        </Button>
        <Button onClick={savePost} className="flex-[2] rounded-full" size="lg">
          Save walk
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function MoodGrid({ value, onChange }: { value: string | null; onChange: (m: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {MOODS.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`rounded-2xl border p-3 text-sm capitalize transition ${
            value === m ? "border-forest bg-forest/10 font-medium text-forest" : "border-border bg-card hover:bg-accent/30"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
