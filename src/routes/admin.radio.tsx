import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Radio, ChevronRight, Rss, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  adminListStations, adminUpsertStation, adminDeleteStation,
  adminListRadioFeeds, adminAddPodcastFeed, adminSyncFeed, adminRemoveFeedSource, adminSetFeedRadioEnabled,
} from "@/lib/radio.functions";

export const Route = createFileRoute("/admin/radio")({
  component: AdminRadio,
  head: () => ({ meta: [{ title: "Admin — Radio" }] }),
});

interface Station {
  id: string; slug: string; title: string; subtitle: string | null; cover_url: string | null;
  is_active: boolean; sort: number;
}
interface Feed {
  id: string; title: string | null; publisher: string | null; image_url: string | null;
  rss_url: string; radio_enabled: boolean; is_active: boolean;
  last_synced_at: string | null; last_sync_error: string | null;
  episode_count: number; referenced_count: number;
}

function AdminRadio() {
  const list = useServerFn(adminListStations);
  const upsert = useServerFn(adminUpsertStation);
  const remove = useServerFn(adminDeleteStation);
  const listFeeds = useServerFn(adminListRadioFeeds);
  const addFeed = useServerFn(adminAddPodcastFeed);
  const syncFeed = useServerFn(adminSyncFeed);
  const removeFeed = useServerFn(adminRemoveFeedSource);
  const setEnabled = useServerFn(adminSetFeedRadioEnabled);

  const [stations, setStations] = useState<Station[] | null>(null);
  const [feeds, setFeeds] = useState<Feed[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ slug: "", title: "", subtitle: "" });
  const [rss, setRss] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    try { setStations((await list()) as Station[]); } catch (e) { toast.error(String(e)); }
    try { setFeeds((await listFeeds()) as Feed[]); } catch (e) { toast.error(String(e)); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const create = async () => {
    if (!form.slug || !form.title) { toast.error("Slug and title required"); return; }
    try {
      await upsert({ data: { slug: form.slug, title: form.title, subtitle: form.subtitle || null } });
      setForm({ slug: "", title: "", subtitle: "" });
      setCreating(false);
      await load();
      toast.success("Station created");
    } catch (e) { toast.error(String(e)); }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this station and all its items?")) return;
    try { await remove({ data: { id } }); await load(); toast.success("Deleted"); } catch (e) { toast.error(String(e)); }
  };

  const doAddFeed = async () => {
    if (!rss) return;
    setAdding(true);
    try {
      const r = await addFeed({ data: { rssUrl: rss } });
      toast.success(r.alreadyExisted ? "Feed already registered — re-synced" : `Added feed (${r.count} episodes)`);
      setRss("");
      await load();
    } catch (e) { toast.error(String(e)); } finally { setAdding(false); }
  };

  const doSync = async (feedId: string) => {
    try { const r = await syncFeed({ data: { feedId } }); toast.success(`Synced ${r.count} episodes`); await load(); }
    catch (e) { toast.error(String(e)); }
  };

  const doRemoveFeed = async (feedId: string) => {
    if (!confirm("Remove this podcast as a Radio source?")) return;
    try { const r = await removeFeed({ data: { feedId } }); toast.success(r.message); await load(); }
    catch (e) { toast.error(String(e)); }
  };

  const doToggleEnabled = async (feedId: string, enabled: boolean) => {
    try { await setEnabled({ data: { feedId, enabled } }); await load(); }
    catch (e) { toast.error(String(e)); }
  };

  return (
    <div className="space-y-6">
      {/* Stations */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-xl"><Radio className="h-4 w-4 text-forest" /> Radio stations</h2>
          <Button size="sm" onClick={() => setCreating((v) => !v)}><Plus className="mr-1 h-3.5 w-3.5" /> New</Button>
        </div>
        {creating && (
          <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
            <Input placeholder="slug (e.g. forest-loop)" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
            <Input placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <Input placeholder="Subtitle (optional)" value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              <Button size="sm" onClick={create}>Create</Button>
            </div>
          </div>
        )}
        {stations === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : stations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No stations yet.</p>
        ) : (
          <ul className="space-y-2">
            {stations.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.title} <span className="text-xs text-muted-foreground">/{s.slug}</span></p>
                  {s.subtitle && <p className="truncate text-xs text-muted-foreground">{s.subtitle}</p>}
                  <p className="text-[10px] text-muted-foreground">{s.is_active ? "Active" : "Hidden"}</p>
                </div>
                <Link to="/admin/radio/$id" params={{ id: s.id }} className="rounded-full bg-secondary px-3 py-1 text-xs">
                  Edit <ChevronRight className="inline h-3 w-3" />
                </Link>
                <button onClick={() => del(s.id)} aria-label="Delete" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Podcast sources */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-xl"><Rss className="h-4 w-4 text-forest" /> Podcast sources</h2>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 sm:flex-row">
          <Input placeholder="Paste RSS feed URL (https://…)" value={rss} onChange={(e) => setRss(e.target.value)} />
          <Button size="sm" onClick={doAddFeed} disabled={adding || !rss}>{adding ? "Adding…" : "Add feed"}</Button>
        </div>
        {feeds === null ? (
          <p className="text-sm text-muted-foreground">Loading feeds…</p>
        ) : feeds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No podcast sources yet. Add an RSS URL above.</p>
        ) : (
          <ul className="space-y-2">
            {feeds.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                {f.image_url ? (
                  <img src={f.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" loading="lazy" />
                ) : (
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted"><Rss className="h-4 w-4 text-muted-foreground" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.title ?? f.rss_url}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {f.publisher ?? "—"} · {f.episode_count} eps · {f.referenced_count} in stations
                    {f.last_sync_error ? ` · error: ${f.last_sync_error.slice(0, 40)}` : ""}
                  </p>
                </div>
                <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Switch checked={f.radio_enabled} onCheckedChange={(v) => doToggleEnabled(f.id, v)} />
                  Radio
                </label>
                <button onClick={() => doSync(f.id)} aria-label="Sync" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-foreground">
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button onClick={() => doRemoveFeed(f.id)} aria-label="Remove" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
