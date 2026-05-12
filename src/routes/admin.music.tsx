import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Upload, Trash2, Play, Pause, Loader2, Star, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/music")({ component: AdminMusic });

const MAX_BYTES = 250 * 1024 * 1024; // 250 MB
const ACCEPTED = /\.(mp3|m4a|aac)$/i;

interface Track {
  id: string;
  title: string;
  artist: string | null;
  genre: string | null;
  mood_tags: string[];
  cover_path: string | null;
  audio_path: string;
  duration_seconds: number;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
}

function AdminMusic() {
  const { user } = useAuth();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<Record<string, { name: string; pct: number }>>({});
  const [drag, setDrag] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ambient_tracks")
      .select("*")
      .order("is_featured", { ascending: false })
      .order("sort_order")
      .order("created_at", { ascending: false });
    setTracks((data ?? []) as Track[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const probeDuration = (file: File) => new Promise<number>((resolve) => {
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => { resolve(Math.round(a.duration || 0)); URL.revokeObjectURL(a.src); };
    a.onerror = () => resolve(0);
    a.src = URL.createObjectURL(file);
  });

  const handleFiles = async (files: FileList | File[]) => {
    if (!user) return;
    const arr = Array.from(files);
    for (const file of arr) {
      const key = crypto.randomUUID();
      try {
        if (/\.wav$/i.test(file.name)) {
          toast.error(`${file.name}: please convert WAV → MP3 or M4A first (smaller mobile data + faster start).`);
          continue;
        }
        if (!ACCEPTED.test(file.name)) {
          toast.error(`${file.name}: unsupported format (use MP3 or M4A)`);
          continue;
        }
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name}: over 250 MB`);
          continue;
        }
        setUploads((u) => ({ ...u, [key]: { name: file.name, pct: 5 } }));
        const duration = await probeDuration(file);
        setUploads((u) => ({ ...u, [key]: { name: file.name, pct: 15 } }));
        const ext = file.name.split(".").pop()!.toLowerCase();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("ambient-music").upload(path, file, {
          cacheControl: "3600",
          contentType: file.type || `audio/${ext === "m4a" ? "mp4" : ext}`,
          upsert: false,
        });
        if (upErr) throw upErr;
        setUploads((u) => ({ ...u, [key]: { name: file.name, pct: 90 } }));
        const title = file.name.replace(/\.[^.]+$/, "");
        const { error: insErr } = await supabase.from("ambient_tracks").insert({
          title, artist: null, audio_path: path, duration_seconds: duration, uploaded_by: user.id,
        });
        if (insErr) throw insErr;
        setUploads((u) => { const n = { ...u }; delete n[key]; return n; });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
        setUploads((u) => { const n = { ...u }; delete n[key]; return n; });
      }
    }
    await load();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const toggleActive = async (t: Track) => {
    await supabase.from("ambient_tracks").update({ is_active: !t.is_active }).eq("id", t.id);
    load();
  };
  const toggleFeatured = async (t: Track) => {
    await supabase.from("ambient_tracks").update({ is_featured: !t.is_featured }).eq("id", t.id);
    load();
  };

  const removeTrack = async (t: Track) => {
    if (!confirm(`Delete "${t.title}"?`)) return;
    await supabase.storage.from("ambient-music").remove([t.audio_path]);
    if (t.cover_path) await supabase.storage.from("ambient-covers").remove([t.cover_path]);
    await supabase.from("ambient_tracks").delete().eq("id", t.id);
    load();
  };

  const updateMeta = async (id: string, patch: Partial<Pick<Track, "title" | "artist" | "genre" | "mood_tags" | "sort_order" | "cover_path">>) => {
    await supabase.from("ambient_tracks").update(patch).eq("id", id);
    setTracks((arr) => arr.map((t) => t.id === id ? { ...t, ...patch } : t));
  };

  const uploadCover = async (t: Track, file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) { toast.error("Cover must be an image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Cover over 5 MB"); return; }
    const ext = file.name.split(".").pop()!.toLowerCase();
    const path = `${user.id}/${t.id}.${ext}`;
    if (t.cover_path && t.cover_path !== path) {
      await supabase.storage.from("ambient-covers").remove([t.cover_path]);
    }
    const { error } = await supabase.storage.from("ambient-covers").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error(error.message); return; }
    await updateMeta(t.id, { cover_path: path });
  };

  const removeCover = async (t: Track) => {
    if (!t.cover_path) return;
    await supabase.storage.from("ambient-covers").remove([t.cover_path]);
    await updateMeta(t.id, { cover_path: null });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl">Music library</h2>
        <p className="mt-1 text-sm text-muted-foreground">Upload MP3 / M4A files (up to 250 MB each — about 1.5 hr at 192 kbps). Tracks appear in the Music tab of the Start-a-Walk flow.</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => fileInput.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed p-8 text-center transition ${drag ? "border-forest bg-accent/40" : "border-border bg-card hover:border-forest/40"}`}
      >
        <Upload className="h-6 w-6 text-muted-foreground" />
        <div className="font-medium">Drop audio files here</div>
        <div className="text-xs text-muted-foreground">.mp3 · .m4a · up to 250 MB each</div>
        <input ref={fileInput} type="file" multiple accept=".mp3,.m4a,.aac,audio/mpeg,audio/mp4,audio/aac" className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      </div>

      {Object.entries(uploads).length > 0 && (
        <div className="space-y-1.5">
          {Object.entries(uploads).map(([k, u]) => (
            <div key={k} className="rounded-xl border border-border bg-card px-3 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate"><Loader2 className="mr-1.5 inline h-3 w-3 animate-spin text-forest" />{u.name}</span>
                <span className="tabular-nums text-muted-foreground">{u.pct}%</span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                <div className="h-full bg-forest transition-all" style={{ width: `${u.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Card className="overflow-hidden rounded-2xl border-border">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : tracks.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No tracks yet. Upload your first one above.</div>
        ) : (
          <ul className="divide-y divide-border">
            {tracks.map((t) => (
              <TrackRow
                key={t.id}
                track={t}
                onToggle={() => toggleActive(t)}
                onFeature={() => toggleFeatured(t)}
                onDelete={() => removeTrack(t)}
                onUpdate={(p) => updateMeta(t.id, p)}
                onCoverUpload={(f) => uploadCover(t, f)}
                onCoverRemove={() => removeCover(t)}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function coverUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from("ambient-covers").getPublicUrl(path).data.publicUrl;
}

function TrackRow({ track, onToggle, onFeature, onDelete, onUpdate, onCoverUpload, onCoverRemove }: {
  track: Track;
  onToggle: () => void;
  onFeature: () => void;
  onDelete: () => void;
  onUpdate: (p: Partial<Pick<Track, "title" | "artist" | "genre" | "mood_tags" | "sort_order">>) => void;
  onCoverUpload: (file: File) => void;
  onCoverRemove: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist ?? "");
  const [genre, setGenre] = useState(track.genre ?? "");
  const [moodInput, setMoodInput] = useState((track.mood_tags ?? []).map(formatTag).join(", "));
  const [sortOrder, setSortOrder] = useState(String(track.sort_order));
  const coverInput = useRef<HTMLInputElement | null>(null);

  const toggle = async () => {
    if (!audioRef.current) {
      const { data } = await supabase.storage.from("ambient-music").createSignedUrl(track.audio_path, 3600);
      if (!data?.signedUrl) return;
      const a = new Audio(data.signedUrl);
      a.onended = () => setPlaying(false);
      audioRef.current = a;
    }
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().catch(() => {}); setPlaying(true); }
  };

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const fmt = (s: number) => {
    if (!s) return "—";
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const cover = coverUrl(track.cover_path);

  const commitMoods = () => {
    const tags = moodInput.split(",").map((s) => s.trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean);
    const same = tags.length === track.mood_tags.length && tags.every((t, i) => t === track.mood_tags[i]);
    if (!same) onUpdate({ mood_tags: tags });
  };

  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <button onClick={toggle} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-primary-foreground" aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>

        {/* Cover */}
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-secondary/60 ring-1 ring-border/60">
          {cover ? (
            <>
              <img src={cover} alt="" className="h-full w-full object-cover" />
              <button onClick={onCoverRemove} className="absolute right-0 top-0 rounded-bl-md bg-black/60 p-0.5 text-white opacity-0 transition hover:opacity-100 group-hover:opacity-100" aria-label="Remove cover">
                <X className="h-3 w-3" />
              </button>
            </>
          ) : (
            <button onClick={() => coverInput.current?.click()} className="flex h-full w-full items-center justify-center text-muted-foreground hover:text-forest" aria-label="Upload cover">
              <ImageIcon className="h-4 w-4" />
            </button>
          )}
          {cover && (
            <button onClick={() => coverInput.current?.click()} className="absolute inset-0 bg-black/0 hover:bg-black/30" aria-label="Replace cover" />
          )}
          <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onCoverUpload(e.target.files[0])} />
        </div>

        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-[1.4fr_1fr_auto]">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== track.title && onUpdate({ title })}
            className="rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-border focus:border-forest focus:outline-none"
            placeholder="Title"
          />
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            onBlur={() => (artist || null) !== track.artist && onUpdate({ artist: artist || null })}
            className="rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-muted-foreground hover:border-border focus:border-forest focus:outline-none"
            placeholder="Artist"
          />
          <span className="text-xs tabular-nums text-muted-foreground">{fmt(track.duration_seconds)}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onFeature}
            title={track.is_featured ? "Unfeature" : "Feature"}
            className={`rounded-full p-1.5 transition ${track.is_featured ? "text-amber-500" : "text-muted-foreground hover:text-amber-500"}`}
          >
            <Star className={`h-4 w-4 ${track.is_featured ? "fill-current" : ""}`} />
          </button>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Switch checked={track.is_active} onCheckedChange={onToggle} />
            {track.is_active ? "On" : "Off"}
          </label>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Secondary metadata row */}
      <div className="grid grid-cols-1 gap-2 pl-12 sm:grid-cols-[1fr_2fr_5rem]">
        <input
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          onBlur={() => (genre || null) !== track.genre && onUpdate({ genre: genre || null })}
          placeholder="Genre (e.g. Lo-fi, Forest)"
          className="rounded-md border border-border bg-card px-2 py-1 text-xs focus:border-forest focus:outline-none"
        />
        <input
          value={moodInput}
          onChange={(e) => setMoodInput(e.target.value)}
          onBlur={commitMoods}
          placeholder="Mood tags (comma-separated, e.g. calm, focused)"
          className="rounded-md border border-border bg-card px-2 py-1 text-xs focus:border-forest focus:outline-none"
        />
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          onBlur={() => {
            const n = parseInt(sortOrder, 10) || 0;
            if (n !== track.sort_order) onUpdate({ sort_order: n });
          }}
          placeholder="Sort"
          className="rounded-md border border-border bg-card px-2 py-1 text-xs tabular-nums focus:border-forest focus:outline-none"
        />
      </div>
    </li>
  );
}

function formatTag(t: string) {
  return t.replace(/_/g, " ");
}
