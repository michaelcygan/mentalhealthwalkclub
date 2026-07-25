import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronLeft, Upload, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  adminGetStation, adminUpsertStation, adminUpsertTrack, adminDeleteTrack, adminSignUpload,
} from "@/lib/radio.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/radio/$id")({
  component: AdminRadioStation,
  head: () => ({ meta: [{ title: "Admin — Radio Station" }] }),
});

interface Station {
  id: string; slug: string; title: string; subtitle: string | null; cover_url: string | null; is_active: boolean; sort: number;
}
interface Track {
  id: string; station_id: string; storage_key: string; title: string; artist: string | null; duration_s: number | null; sort: number; is_active: boolean;
}

function AdminRadioStation() {
  const { id } = Route.useParams();
  const router = useRouter();
  const get = useServerFn(adminGetStation);
  const upStation = useServerFn(adminUpsertStation);
  const upTrack = useServerFn(adminUpsertTrack);
  const delTrack = useServerFn(adminDeleteTrack);
  const signUp = useServerFn(adminSignUpload);

  const [station, setStation] = useState<Station | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [coverSigned, setCoverSigned] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingTrack, setUploadingTrack] = useState(false);

  const load = async () => {
    const r = await get({ data: { id } });
    setStation(r.station as Station);
    setTracks((r.tracks ?? []) as Track[]);
    setCoverSigned(r.coverSigned);
  };
  useEffect(() => { load().catch((e) => toast.error(String(e))); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const save = async () => {
    if (!station) return;
    setSaving(true);
    try {
      await upStation({ data: { id: station.id, slug: station.slug, title: station.title, subtitle: station.subtitle, cover_url: station.cover_url, is_active: station.is_active, sort: station.sort } });
      toast.success("Saved");
    } catch (e) { toast.error(String(e)); } finally { setSaving(false); }
  };

  const uploadCover = async (file: File) => {
    if (!station) return;
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${station.slug}/cover-${Date.now()}.${ext}`;
      const { token } = await signUp({ data: { bucket: "radio-covers", path } });
      const { error } = await supabase.storage.from("radio-covers").uploadToSignedUrl(path, token, file);
      if (error) throw error;
      setStation({ ...station, cover_url: path });
      await upStation({ data: { id: station.id, slug: station.slug, title: station.title, subtitle: station.subtitle, cover_url: path, is_active: station.is_active, sort: station.sort } });
      await load();
      toast.success("Cover updated");
    } catch (e) { toast.error(String(e)); }
  };

  const uploadTrack = async (file: File) => {
    if (!station) return;
    setUploadingTrack(true);
    try {
      const ext = file.name.split(".").pop() || "mp3";
      const path = `${station.slug}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { token } = await signUp({ data: { bucket: "radio-tracks", path } });
      const { error } = await supabase.storage.from("radio-tracks").uploadToSignedUrl(path, token, file);
      if (error) throw error;
      await upTrack({ data: { station_id: station.id, storage_key: path, title: file.name.replace(/\.[^.]+$/, ""), sort: tracks.length } });
      await load();
      toast.success("Track uploaded");
    } catch (e) { toast.error(String(e)); } finally { setUploadingTrack(false); }
  };

  const removeTrack = async (tid: string) => {
    if (!confirm("Delete this track?")) return;
    try { await delTrack({ data: { id: tid } }); await load(); toast.success("Removed"); } catch (e) { toast.error(String(e)); }
  };

  if (!station) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-5">
      <Link to="/admin/radio" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ChevronLeft className="h-3.5 w-3.5" /> All stations</Link>

      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-4">
          <label className="grid h-24 w-24 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-border bg-muted">
            {coverSigned ? <img src={coverSigned} alt="" className="h-full w-full object-cover" decoding="async" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} />
          </label>
          <div className="flex-1 space-y-2">
            <Input value={station.title} onChange={(e) => setStation({ ...station, title: e.target.value })} placeholder="Title" />
            <Input value={station.subtitle ?? ""} onChange={(e) => setStation({ ...station, subtitle: e.target.value || null })} placeholder="Subtitle" />
            <Input value={station.slug} onChange={(e) => setStation({ ...station, slug: e.target.value })} placeholder="slug" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs"><Switch checked={station.is_active} onCheckedChange={(v) => setStation({ ...station, is_active: v })} /> Active</label>
          <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg">Tracks</h3>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-forest px-3 py-1.5 text-xs text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> {uploadingTrack ? "Uploading…" : "Add track"}
            <input type="file" accept="audio/*" className="hidden" disabled={uploadingTrack} onChange={(e) => e.target.files?.[0] && uploadTrack(e.target.files[0])} />
          </label>
        </div>
        {tracks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tracks yet — upload some audio.</p>
        ) : (
          <ul className="space-y-2">
            {tracks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{t.artist ?? "—"} · {t.storage_key}</p>
                </div>
                <button onClick={() => removeTrack(t.id)} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
