import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ChevronLeft, Upload, Trash2, Plus, Link as LinkIcon, Podcast, Music,
  Shuffle, ListOrdered, Repeat, GripVertical, PlayCircle,
} from "lucide-react";
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors,
  closestCenter, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  adminGetStation, adminUpsertStation, adminUpsertTrack, adminDeleteTrack, adminSignUpload,
  adminAddExternalUrl, adminAddPodcastEpisodesToStation, adminListRadioFeeds, adminListFeedEpisodes,
  adminPatchTrack, adminReorderTracks, resolveRadioItem,
} from "@/lib/radio.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/radio/$id")({
  component: AdminRadioStation,
  head: () => ({ meta: [{ title: "Admin — Radio Station" }] }),
});

interface Station {
  id: string; slug: string; title: string; subtitle: string | null; cover_url: string | null;
  is_active: boolean; sort: number;
  playback_mode: "ordered" | "shuffle"; loop_enabled: boolean; is_default: boolean;
}
interface Track {
  id: string; station_id: string; source_type: "upload" | "external_url" | "podcast_episode";
  storage_key: string | null; external_url: string | null; podcast_episode_id: string | null;
  title: string; artist: string | null; duration_s: number | null; sort: number;
  repeat_count: number; is_active: boolean;
  podcast_episodes?: { title: string; episode_url: string | null; podcast_feeds?: { title: string | null; publisher: string | null } | null } | null;
}
interface Feed {
  id: string; title: string | null; publisher: string | null; image_url: string | null;
  rss_url: string; radio_enabled: boolean; episode_count: number;
}
interface Episode {
  id: string; title: string; published_at: string | null; duration_seconds: number | null;
  audio_url: string; episode_url: string | null; image_url: string | null; in_station: boolean;
}

function AdminRadioStation() {
  const { id } = Route.useParams();
  useRouter();
  const get = useServerFn(adminGetStation);
  const upStation = useServerFn(adminUpsertStation);
  const upTrack = useServerFn(adminUpsertTrack);
  const patchTrack = useServerFn(adminPatchTrack);
  const reorderTracks = useServerFn(adminReorderTracks);
  const resolveItem = useServerFn(resolveRadioItem);
  const delTrack = useServerFn(adminDeleteTrack);
  const signUp = useServerFn(adminSignUpload);
  const addUrl = useServerFn(adminAddExternalUrl);
  const addPodcasts = useServerFn(adminAddPodcastEpisodesToStation);
  const listFeeds = useServerFn(adminListRadioFeeds);
  const listEpisodes = useServerFn(adminListFeedEpisodes);

  const [station, setStation] = useState<Station | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [coverSigned, setCoverSigned] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingTrack, setUploadingTrack] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

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
      await upStation({ data: {
        id: station.id, slug: station.slug, title: station.title, subtitle: station.subtitle,
        cover_url: station.cover_url, is_active: station.is_active, sort: station.sort,
        playback_mode: station.playback_mode, loop_enabled: station.loop_enabled, is_default: station.is_default,
      } });
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
      void ext;
      const { token } = await signUp({ data: { bucket: "radio-tracks", path } });
      const { error } = await supabase.storage.from("radio-tracks").uploadToSignedUrl(path, token, file);
      if (error) throw error;
      await upTrack({ data: { station_id: station.id, storage_key: path, title: file.name.replace(/\.[^.]+$/, ""), sort: tracks.length } });
      await load();
      toast.success("Track uploaded");
    } catch (e) { toast.error(String(e)); } finally { setUploadingTrack(false); }
  };

  const removeTrack = async (tid: string) => {
    if (!confirm("Remove this item from the station?")) return;
    try { await delTrack({ data: { id: tid } }); await load(); toast.success("Removed"); } catch (e) { toast.error(String(e)); }
  };

  const setActive = async (t: Track, v: boolean) => {
    setTracks((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_active: v } : x)));
    try { await patchTrack({ data: { id: t.id, is_active: v } }); }
    catch (e) { toast.error(String(e)); await load(); }
  };

  const setRepeat = async (t: Track, n: number) => {
    const clamped = Math.max(1, Math.min(20, Math.round(n) || 1));
    setTracks((prev) => prev.map((x) => (x.id === t.id ? { ...x, repeat_count: clamped } : x)));
    try { await patchTrack({ data: { id: t.id, repeat_count: clamped } }); }
    catch (e) { toast.error(String(e)); await load(); }
  };

  const testResolve = async (t: Track) => {
    setTestingId(t.id);
    try {
      const r = await resolveItem({ data: { itemId: t.id } });
      if (!r) toast.error("Could not resolve — source unavailable.");
      else toast.success(`OK · ${r.sourceType}${r.durationSeconds ? ` · ${Math.round(r.durationSeconds / 60)}m` : ""}`);
    } catch (e) { toast.error(String(e)); } finally { setTestingId(null); }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id || !station) return;
    const oldIndex = tracks.findIndex((t) => t.id === active.id);
    const newIndex = tracks.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(tracks, oldIndex, newIndex);
    setTracks(next);
    try {
      await reorderTracks({ data: { stationId: station.id, orderedIds: next.map((t) => t.id) } });
    } catch (err) {
      toast.error(String(err));
      await load();
    }
  };

  if (!station) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-5">
      <Link to="/admin/radio" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ChevronLeft className="h-3.5 w-3.5" /> All stations</Link>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
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

        <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-4">
          <label className="flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2 text-xs">
            <Switch checked={station.is_active} onCheckedChange={(v) => setStation({ ...station, is_active: v })} /> Active
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2 text-xs">
            <Switch checked={station.loop_enabled} onCheckedChange={(v) => setStation({ ...station, loop_enabled: v })} />
            <Repeat className="h-3.5 w-3.5" /> Loop
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2 text-xs">
            <Switch
              checked={station.playback_mode === "shuffle"}
              onCheckedChange={(v) => setStation({ ...station, playback_mode: v ? "shuffle" : "ordered" })}
            />
            {station.playback_mode === "shuffle" ? <Shuffle className="h-3.5 w-3.5" /> : <ListOrdered className="h-3.5 w-3.5" />}
            {station.playback_mode === "shuffle" ? "Shuffle" : "Ordered"}
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2 text-xs">
            <Switch checked={station.is_default} onCheckedChange={(v) => setStation({ ...station, is_default: v })} /> Default
          </label>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg">Playlist</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setAddSheetOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add source
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-forest px-3 py-1.5 text-xs text-primary-foreground">
              <Upload className="h-3.5 w-3.5" /> {uploadingTrack ? "Uploading…" : "Upload"}
              <input type="file" accept="audio/*" className="hidden" disabled={uploadingTrack} onChange={(e) => e.target.files?.[0] && uploadTrack(e.target.files[0])} />
            </label>
          </div>
        </div>
        {tracks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center">
            <p className="font-serif text-sm text-foreground">Nothing on this station yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">Upload audio, paste a link, or pick from a podcast feed.</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={tracks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {tracks.map((t) => (
                  <SortableTrackRow
                    key={t.id}
                    track={t}
                    onRemove={() => removeTrack(t.id)}
                    onActive={(v) => setActive(t, v)}
                    onRepeat={(n) => setRepeat(t, n)}
                    onTest={() => testResolve(t)}
                    testing={testingId === t.id}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
        <p className="pt-1 text-[11px] text-muted-foreground">Drag rows to reorder. Repeat sets how many times an item plays in one cycle.</p>
      </section>

      <AddSourceDialog
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
        stationId={station.id}
        onDone={load}
        addUrl={addUrl}
        addPodcasts={addPodcasts}
        listFeeds={listFeeds}
        listEpisodes={listEpisodes}
      />
    </div>
  );
}

function SortableTrackRow({
  track: t, onRemove, onActive, onRepeat, onTest, testing,
}: {
  track: Track;
  onRemove: () => void;
  onActive: (v: boolean) => void;
  onRepeat: (n: number) => void;
  onTest: () => void;
  testing: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: t.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-2xl border border-border bg-card p-2.5 sm:gap-3 sm:p-3 ${t.is_active ? "" : "opacity-60"}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="grid h-8 w-6 shrink-0 place-items-center rounded text-muted-foreground hover:text-foreground touch-none cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <SourceBadge kind={t.source_type} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{t.title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{sourceLabel(t)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <label className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex" title="Repeat count">
          <Repeat className="h-3 w-3" />
          <input
            type="number"
            min={1}
            max={20}
            defaultValue={t.repeat_count}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (n !== t.repeat_count) onRepeat(n);
            }}
            className="w-12 rounded-md border border-border bg-background px-1.5 py-0.5 text-center text-[11px]"
          />
        </label>
        <Switch checked={t.is_active} onCheckedChange={onActive} aria-label="Active" />
        <button
          onClick={onTest}
          disabled={testing}
          aria-label="Test resolve"
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-50"
          title="Test resolve"
        >
          <PlayCircle className="h-4 w-4" />
        </button>
        <button
          onClick={onRemove}
          aria-label="Remove"
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

function sourceLabel(t: Track): string {
  if (t.source_type === "upload") return t.storage_key ?? "Upload";
  if (t.source_type === "external_url") return t.external_url ?? "Link";
  const pub = t.podcast_episodes?.podcast_feeds?.publisher ?? t.podcast_episodes?.podcast_feeds?.title ?? t.artist ?? "Podcast";
  return `Podcast · ${pub}`;
}

function SourceBadge({ kind }: { kind: Track["source_type"] }) {
  const map = {
    upload: { icon: Music, label: "File", cls: "bg-forest/10 text-forest" },
    external_url: { icon: LinkIcon, label: "Link", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    podcast_episode: { icon: Podcast, label: "Pod", cls: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
  } as const;
  const { icon: Icon, label, cls } = map[kind];
  return (
    <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] ${cls}`} title={label}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

function AddSourceDialog({
  open, onOpenChange, stationId, onDone, addUrl, addPodcasts, listFeeds, listEpisodes,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; stationId: string; onDone: () => Promise<void>;
  addUrl: ReturnType<typeof useServerFn<typeof adminAddExternalUrl>>;
  addPodcasts: ReturnType<typeof useServerFn<typeof adminAddPodcastEpisodesToStation>>;
  listFeeds: ReturnType<typeof useServerFn<typeof adminListRadioFeeds>>;
  listEpisodes: ReturnType<typeof useServerFn<typeof adminListFeedEpisodes>>;
}) {
  const [tab, setTab] = useState("link");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add to station</DialogTitle></DialogHeader>
        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link"><LinkIcon className="mr-1 h-3.5 w-3.5" /> Link</TabsTrigger>
            <TabsTrigger value="podcast"><Podcast className="mr-1 h-3.5 w-3.5" /> Podcast</TabsTrigger>
          </TabsList>
          <TabsContent value="link" className="mt-3">
            <LinkTab stationId={stationId} addUrl={addUrl} onDone={async () => { await onDone(); onOpenChange(false); }} />
          </TabsContent>
          <TabsContent value="podcast" className="mt-3">
            <PodcastTab
              stationId={stationId}
              addPodcasts={addPodcasts}
              listFeeds={listFeeds}
              listEpisodes={listEpisodes}
              onDone={async () => { await onDone(); onOpenChange(false); }}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function LinkTab({
  stationId, addUrl, onDone,
}: {
  stationId: string;
  addUrl: ReturnType<typeof useServerFn<typeof adminAddExternalUrl>>;
  onDone: () => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!url || !title) { toast.error("URL and title required"); return; }
    setBusy(true);
    try {
      await addUrl({ data: { station_id: stationId, external_url: url, title, artist: artist || null } });
      toast.success("Link added");
      setUrl(""); setTitle(""); setArtist("");
      await onDone();
    } catch (e) { toast.error(String(e)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2">
      <Input placeholder="https:// direct audio URL (mp3, m4a, ...)" value={url} onChange={(e) => setUrl(e.target.value)} />
      <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input placeholder="Artist (optional)" value={artist} onChange={(e) => setArtist(e.target.value)} />
      <p className="text-[11px] text-muted-foreground">Must be an HTTPS public URL. We validate that it isn't a local address.</p>
      <div className="flex justify-end pt-1">
        <Button size="sm" onClick={submit} disabled={busy}>{busy ? "Adding…" : "Add"}</Button>
      </div>
    </div>
  );
}

function PodcastTab({
  stationId, addPodcasts, listFeeds, listEpisodes, onDone,
}: {
  stationId: string;
  addPodcasts: ReturnType<typeof useServerFn<typeof adminAddPodcastEpisodesToStation>>;
  listFeeds: ReturnType<typeof useServerFn<typeof adminListRadioFeeds>>;
  listEpisodes: ReturnType<typeof useServerFn<typeof adminListFeedEpisodes>>;
  onDone: () => Promise<void>;
}) {
  const [feeds, setFeeds] = useState<Feed[] | null>(null);
  const [selectedFeed, setSelectedFeed] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listFeeds().then((f) => {
      const arr = (f as Feed[]).filter((x) => x.radio_enabled);
      setFeeds(arr);
      if (arr.length && !selectedFeed) setSelectedFeed(arr[0].id);
    }).catch((e) => toast.error(String(e)));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  useEffect(() => {
    if (!selectedFeed) return;
    setEpisodes(null);
    setSelected(new Set());
    listEpisodes({ data: { feedId: selectedFeed, stationId, limit: 50 } })
      .then((e) => setEpisodes(e as Episode[]))
      .catch((e) => toast.error(String(e)));
  }, [selectedFeed, stationId, listEpisodes]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const submit = async () => {
    if (!selected.size) { toast.error("Pick at least one episode"); return; }
    setBusy(true);
    try {
      const r = await addPodcasts({ data: { stationId, episodeIds: Array.from(selected) } });
      toast.success(`Added ${r.added}${r.alreadyPresent ? ` · ${r.alreadyPresent} already there` : ""}`);
      await onDone();
    } catch (e) { toast.error(String(e)); } finally { setBusy(false); }
  };

  if (feeds === null) return <p className="text-sm text-muted-foreground">Loading feeds…</p>;
  if (!feeds.length) return (
    <p className="text-sm text-muted-foreground">
      No podcast sources yet. Go to <Link to="/admin/radio" className="underline">Radio admin</Link> and add a feed first.
    </p>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {feeds.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelectedFeed(f.id)}
            className={`rounded-full border px-3 py-1 text-xs ${selectedFeed === f.id ? "border-forest bg-forest/10 text-forest" : "border-border text-muted-foreground"}`}
          >
            {f.title ?? f.rss_url}
          </button>
        ))}
      </div>
      <div className="max-h-80 overflow-y-auto rounded-xl border border-border">
        {episodes === null ? (
          <p className="p-3 text-sm text-muted-foreground">Loading episodes…</p>
        ) : episodes.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No episodes.</p>
        ) : (
          <ul className="divide-y divide-border">
            {episodes.map((e) => (
              <li key={e.id} className={`flex items-start gap-3 p-2 ${e.in_station ? "opacity-50" : ""}`}>
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(e.id) || e.in_station}
                  disabled={e.in_station}
                  onChange={() => !e.in_station && toggle(e.id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm">{e.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {e.published_at ? new Date(e.published_at).toLocaleDateString() : "—"}
                    {e.duration_seconds ? ` · ${Math.round(e.duration_seconds / 60)} min` : ""}
                    {e.in_station ? " · already in station" : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{selected.size} selected</span>
        <Button size="sm" onClick={submit} disabled={busy || !selected.size}>{busy ? "Adding…" : `Add ${selected.size}`}</Button>
      </div>
    </div>
  );
}
