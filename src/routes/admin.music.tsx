import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Upload, Trash2, Play, Pause, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/music")({ component: AdminMusic });

interface Track {
  id: string;
  title: string;
  artist: string | null;
  audio_path: string;
  duration_seconds: number;
  is_active: boolean;
  created_at: string;
}

function AdminMusic() {
  const { user } = useAuth();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(0);
  const [drag, setDrag] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("ambient_tracks").select("*").order("created_at", { ascending: false });
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
    setUploading(arr.length);
    for (const file of arr) {
      try {
        if (!/\.(mp3|m4a|ogg|wav)$/i.test(file.name)) {
          toast.error(`${file.name}: unsupported format`);
          continue;
        }
        if (file.size > 25 * 1024 * 1024) {
          toast.error(`${file.name}: over 25 MB`);
          continue;
        }
        const duration = await probeDuration(file);
        const ext = file.name.split(".").pop()!.toLowerCase();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("ambient-music").upload(path, file, {
          cacheControl: "3600",
          contentType: file.type || `audio/${ext}`,
        });
        if (upErr) throw upErr;
        const title = file.name.replace(/\.[^.]+$/, "");
        const { error: insErr } = await supabase.from("ambient_tracks").insert({
          title, artist: null, audio_path: path, duration_seconds: duration, uploaded_by: user.id,
        });
        if (insErr) throw insErr;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading((n) => n - 1);
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

  const removeTrack = async (t: Track) => {
    if (!confirm(`Delete "${t.title}"?`)) return;
    await supabase.storage.from("ambient-music").remove([t.audio_path]);
    await supabase.from("ambient_tracks").delete().eq("id", t.id);
    load();
  };

  const updateMeta = async (id: string, patch: Partial<Pick<Track, "title" | "artist">>) => {
    await supabase.from("ambient_tracks").update(patch).eq("id", id);
    setTracks((arr) => arr.map((t) => t.id === id ? { ...t, ...patch } : t));
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl">Ambient music library</h2>
        <p className="mt-1 text-sm text-muted-foreground">Tracks here shuffle quietly during the pre-walk drawer and walks. Users can mute or skip from the walk screen.</p>
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
        <div className="text-xs text-muted-foreground">.mp3, .m4a, .ogg, .wav · up to 25 MB each</div>
        {uploading > 0 && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-forest"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading {uploading}…</div>
        )}
        <input ref={fileInput} type="file" multiple accept="audio/*,.mp3,.m4a,.ogg,.wav" className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      </div>

      <Card className="overflow-hidden rounded-2xl border-border">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : tracks.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No tracks yet. Upload your first one above.</div>
        ) : (
          <ul className="divide-y divide-border">
            {tracks.map((t) => (
              <TrackRow key={t.id} track={t} onToggle={() => toggleActive(t)} onDelete={() => removeTrack(t)} onUpdate={(p) => updateMeta(t.id, p)} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function TrackRow({ track, onToggle, onDelete, onUpdate }: {
  track: Track;
  onToggle: () => void; onDelete: () => void;
  onUpdate: (p: Partial<Pick<Track, "title" | "artist">>) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist ?? "");

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

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <button onClick={toggle} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-primary-foreground" aria-label={playing ? "Pause" : "Play"}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
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
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Switch checked={track.is_active} onCheckedChange={onToggle} />
          {track.is_active ? "On" : "Off"}
        </label>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}
