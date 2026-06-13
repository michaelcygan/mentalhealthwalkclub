import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Footprints, Play, Square, Pause, ArrowLeft, Sparkles, Activity, X,
  ChevronRight, PenLine, ImagePlus, Check, Music2,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AudioSourcePicker, type AudioSource } from "@/components/audio/audio-source-picker";
import { useAmbient } from "@/lib/ambient-context";
import { usePlayer, type PlayableTrack } from "@/lib/player-context";
import { useStepCounter } from "@/hooks/use-step-counter";
import { useGeolocation, useCurrentWeather } from "@/hooks/use-weather";
import WalkWeather from "@/components/walk-page/walk-weather";
import { listMyPlaylists, getPlaylist, listenCatalog } from "@/lib/playlists.functions";
import { PROMPTS, moodToFamily, promptsForMood, type ReflectionPrompt } from "@/lib/reflection-prompts";
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

const MOODS = ["okay", "steady", "hopeful", "grateful", "anxious", "heavy"];
const WALK_STATE_KEY = "mhwc_active_solo_walk";
const WALK_NOTE_KEY = "mhwc_walk_note_draft";

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
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalPrompt, setJournalPrompt] = useState<string | null>(null);
  const [promptOffset, setPromptOffset] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);
  const reduceMotion = useReducedMotion();
  const audioStartedFor = useRef<string | null>(null);

  const [playlists, setPlaylists] = useState<{ id: string; name: string }[]>([]);
  const [podcasts, setPodcasts] = useState<{ id: string; title: string }[]>([]);

  const { coords } = useGeolocation({ autoRequest: false, ipFallback: true });
  const { data: weather } = useCurrentWeather(coords);

  const ambient = useAmbient();
  const player = usePlayer();
  const stepCounter = useStepCounter(stage === "active" && !paused, walkId);

  useEffect(() => {
    const saved = window.localStorage.getItem(WALK_STATE_KEY);
    if (!saved) return;
    try {
      const state = JSON.parse(saved) as { walkId: string; startedAt: number; pausedAccum: number; pausedAt?: number | null; paused?: boolean; moodBefore: string | null; intention: string; source: AudioSource; journalPrompt?: string | null };
      if (!state.walkId || !state.startedAt) return;
      setWalkId(state.walkId);
      setStartedAt(state.startedAt);
      pausedAccum.current = state.pausedAccum || 0;
      pausedAt.current = state.pausedAt ?? null;
      setPaused(Boolean(state.paused));
      setMoodBefore(state.moodBefore);
      setIntention(state.intention || "");
      setSource(state.source || { kind: "silence" });
      setJournalPrompt(state.journalPrompt ?? null);
      setNote(window.localStorage.getItem(WALK_NOTE_KEY) || "");
      setStage("active");
    } catch { window.localStorage.removeItem(WALK_STATE_KEY); }
  }, []);

  useEffect(() => {
    if (stage !== "active" || !walkId || startedAt == null) return;
    window.localStorage.setItem(WALK_STATE_KEY, JSON.stringify({ walkId, startedAt, pausedAccum: pausedAccum.current, pausedAt: pausedAt.current, paused, moodBefore, intention, source, journalPrompt }));
  }, [stage, walkId, startedAt, paused, moodBefore, intention, source, journalPrompt]);

  useEffect(() => {
    if (stage === "active") window.localStorage.setItem(WALK_NOTE_KEY, note);
  }, [stage, note]);

  useEffect(() => {
    const openJournal = () => {
      if (stage !== "active") return;
      setJournalOpen(true);
      window.setTimeout(() => document.getElementById("walk-journal-note")?.focus(), 180);
    };
    window.addEventListener("mhwc:open-walk-journal", openJournal);
    return () => window.removeEventListener("mhwc:open-walk-journal", openJournal);
  }, [stage]);

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

  useEffect(() => {
    if (stage !== "active") return;
    const sourceKey = source.kind === "podcast_episode" ? `podcast:${source.track_id}` : source.kind === "playlist" ? `playlist:${source.playlist_id}` : source.kind;
    if (audioStartedFor.current === sourceKey) return;
    audioStartedFor.current = sourceKey;
    let cancelled = false;
    (async () => {
      if (source.kind === "podcast_episode") {
        const { data } = await supabase
          .from("podcast_episodes")
          .select("id,title,audio_url,image_url,duration_seconds,episode_url")
          .eq("id", source.track_id)
          .maybeSingle();
        if (!cancelled && data?.audio_url) {
          player.play({ id: data.id, kind: "podcast", title: data.title, cover: data.image_url, audio_url: data.audio_url, duration_seconds: data.duration_seconds, link: data.episode_url });
        }
      } else if (source.kind === "playlist") {
        const r = await getPlaylist({ data: { id: source.playlist_id } });
        const tracks: PlayableTrack[] = [];
        for (const it of r.items) {
          if (it.kind === "podcast_episode") {
            const { data } = await supabase.from("podcast_episodes").select("id,title,audio_url,image_url,duration_seconds,episode_url").eq("id", it.track_id).maybeSingle();
            if (data?.audio_url) tracks.push({ id: data.id, kind: "podcast", title: data.title, cover: data.image_url, audio_url: data.audio_url, duration_seconds: data.duration_seconds, link: data.episode_url });
          } else if (it.kind === "guided_track") {
            const { data } = await supabase.from("guided_tracks").select("id,title,host,audio_url,cover_url,duration_seconds").eq("id", it.track_id).maybeSingle();
            if (data?.audio_url) tracks.push({ id: data.id, kind: "guided", title: data.title, subtitle: data.host, cover: data.cover_url, audio_url: data.audio_url, duration_seconds: data.duration_seconds });
          }
        }
        if (!cancelled && tracks[0]) {
          player.play(tracks[0]);
          tracks.slice(1).forEach(player.enqueue);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [stage, source, player.play, player.enqueue]);

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
      audioStartedFor.current = null;
      setStage("active");
      if (source.kind === "ambient") { player.stop(); await ambient.start(); }
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
          reflection_prompt: note.trim() ? journalPrompt : null,
          weather_at_end: weather ? { tempF: weather.tempF, label: weather.label, code: weather.code } : null,
        })
        .eq("id", walkId);
      if (error) throw error;
      window.localStorage.removeItem(WALK_STATE_KEY);
      window.localStorage.removeItem(WALK_NOTE_KEY);
      toast.success("Walk saved");
      navigate({ to: "/journal" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function startOver() {
    if (walkId) {
      const { error } = await supabase.from("walk_sessions").update({ status: "abandoned", ended_at: new Date().toISOString(), duration_seconds: elapsed }).eq("id", walkId);
      if (error) { toast.error(error.message); return; }
    }
    window.localStorage.removeItem(WALK_STATE_KEY);
    window.localStorage.removeItem(WALK_NOTE_KEY);
    setStage("pre");
    setWalkId(null);
    setStartedAt(null);
    setElapsed(0);
    setNote("");
    setJournalPrompt(null);
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
    else { setPhotoCount((count) => count + 1); toast.success("Snapshot saved"); }
  }

  // Reflection prompt for the post stage
  const reflectionPrompt: ReflectionPrompt | null = useMemo(() => {
    if (stage !== "post") return null;
    const family = moodToFamily(moodBefore);
    const pool = PROMPTS.filter((p) => p.family === family || p.family === "universal");
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }, [stage, moodBefore]);

  const activePrompts = useMemo(() => promptsForMood(moodBefore), [moodBefore]);
  const activePrompt = activePrompts.length > 0
    ? activePrompts[(Math.floor(elapsed / 240) + promptOffset) % activePrompts.length]
    : null;

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

        <Section title="How are you arriving? Choose whatever feels closest.">
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
      <div className="mx-auto max-w-2xl px-4 pb-44 pt-4">
        <header className="relative mb-6 overflow-hidden rounded-[2rem] border border-border/70 bg-card/75 px-5 py-6 text-center shadow-soft backdrop-blur-xl">
          <div className={`absolute inset-x-10 top-0 h-px bg-forest transition-opacity ${paused ? "opacity-20" : "opacity-70"}`} />
          <p className={`text-xs font-medium uppercase tracking-[0.18em] transition-colors ${paused ? "text-clay" : "text-forest"}`}>
            {paused ? "Walk paused" : "Walk in progress"}
          </p>
          <div role="timer" aria-label={`Walk time: ${Math.floor(elapsed / 60)} minutes ${elapsed % 60} seconds`} className="mt-3 font-serif text-6xl tabular-nums tracking-tight">
            {fmtClock(elapsed)}
          </div>
          <div className="mt-4 flex items-center justify-center gap-3 text-xs text-muted-foreground">
            {stepCounter.permissionState === "granted" && <span className="inline-flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> {stepCounter.steps} steps</span>}
            {weather && <span>{weather.tempF}° · {weather.label}</span>}
          </div>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Button onClick={togglePause} variant="outline" size="lg" aria-label={paused ? "Resume walk" : "Pause walk"} className="h-12 w-12 rounded-full p-0">
              {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
            </Button>
            <Button onClick={endWalk} size="lg" className="h-12 rounded-full px-6">
              <Square className="mr-2 h-4 w-4" /> End walk
            </Button>
          </div>
        </header>

        {intention && (
          <blockquote className="mb-6 rounded-3xl border border-border bg-card p-4 text-center font-serif text-sm italic text-muted-foreground">
            "{intention}"
          </blockquote>
        )}

        {source.kind === "ambient" && ambient.current && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border/70 bg-card/70 p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-forest"><Music2 className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{ambient.current.title}</p><p className="text-[11px] text-muted-foreground">Ambient mix</p></div>
            <Button variant="ghost" size="sm" onClick={ambient.skip} className="rounded-full">Next</Button>
          </div>
        )}

        {activePrompt && (
          <div className="mb-3 overflow-hidden rounded-3xl border border-border/70 bg-card/55 p-5 text-center">
            <p className="mb-3 inline-flex items-center gap-1 text-xs uppercase tracking-[0.16em] text-muted-foreground"><Sparkles className="h-3.5 w-3.5" /> Something to notice</p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.button
                key={activePrompt.id}
                type="button"
                onClick={() => { setJournalPrompt(activePrompt.text); setJournalOpen(true); }}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -5 }}
                className="block w-full font-serif text-base italic leading-relaxed"
              >
                {activePrompt.text}
              </motion.button>
            </AnimatePresence>
            <Button variant="ghost" size="sm" onClick={() => setPromptOffset((value) => value + 1)} className="mt-3 rounded-full text-xs text-muted-foreground">Another prompt <ChevronRight className="h-3.5 w-3.5" /></Button>
          </div>
        )}

        <div className="rounded-3xl border border-border/70 bg-card/75 p-3 shadow-soft">
          <button type="button" onClick={() => setJournalOpen((open) => !open)} className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-2 text-left" aria-expanded={journalOpen}>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-accent/70 text-forest"><PenLine className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium">A note from this walk</span><span className="block truncate text-xs text-muted-foreground">{note || "Tap to jot something down"}</span></span>
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${journalOpen ? "rotate-90" : ""}`} />
          </button>
          <AnimatePresence initial={false}>
            {journalOpen && <motion.div initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }} className="overflow-hidden"><Textarea id="walk-journal-note" autoFocus value={note} onChange={(e) => { if (!journalPrompt && activePrompt) setJournalPrompt(activePrompt.text); setNote(e.target.value); }} placeholder="Write without pressure…" rows={4} maxLength={2000} className="mt-2 rounded-2xl" /></motion.div>}
          </AnimatePresence>
        </div>

        <label aria-label="Add a photo from this walk" className="mt-3 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card/75 px-4 text-sm font-medium text-forest shadow-soft transition active:scale-[0.99]">
          {photoCount > 0 ? <Check className="h-5 w-5" /> : <ImagePlus className="h-5 w-5" />}
          <span>{photoCount > 0 ? `${photoCount} saved` : "Add photo"}</span>
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
           autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
           placeholder={reflectionPrompt ? "What did this bring up for you?" : "What's worth keeping from this walk?"}
          rows={5}
          maxLength={2000}
          className="rounded-2xl"
        />
         {note.length > 1600 && <p className="mt-1 text-right text-xs text-muted-foreground">{2000 - note.length} characters left</p>}
      </Section>

      <div className="flex gap-2">
         <Button onClick={startOver} variant="outline" className="flex-1 rounded-full">
           <X className="mr-1 h-4 w-4" /> Start over
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
