import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { syncPodcastFeed, createPodcastFeed } from "@/lib/podcasts.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, RefreshCw, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/podcasts")({ component: AdminPodcasts });

interface Feed {
  id: string;
  rss_url: string;
  title: string;
  publisher: string | null;
  category: string;
  credibility: string;
  is_active: boolean;
  last_synced_at: string | null;
  last_sync_error: string | null;
  image_url: string | null;
}

const CATS = ["calm_down", "think_clearly", "feel_connected", "walk_with_hope", "body_brain", "relationships"] as const;
const CREDS = ["institutional", "academic", "public_media", "science", "lifestyle"] as const;

function AdminPodcasts() {
  const [feeds, setFeeds] = useState<Feed[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ rss_url: "", title: "", publisher: "", category: "think_clearly" as typeof CATS[number], credibility: "lifestyle" as typeof CREDS[number] });
  const sync = useServerFn(syncPodcastFeed);
  const createFeed = useServerFn(createPodcastFeed);

  const load = async () => {
    const { data } = await supabase.from("podcast_feeds").select("*").order("created_at", { ascending: false });
    setFeeds((data ?? []) as Feed[]);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (f: Feed) => {
    await supabase.from("podcast_feeds").update({ is_active: !f.is_active }).eq("id", f.id);
    load();
  };

  const runSync = async (f: Feed) => {
    setBusy(f.id);
    try {
      const r = await sync({ data: { feedId: f.id } });
      toast.success(`Synced ${r.count} episodes`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(null);
    }
  };

  const submitNew = async () => {
    if (!form.rss_url || !form.title) { toast.error("URL and title required"); return; }
    setAdding(true);
    try {
      await createFeed({ data: form });
      toast.success("Feed added");
      setForm({ rss_url: "", title: "", publisher: "", category: "think_clearly", credibility: "lifestyle" });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Add failed");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 font-serif text-lg"><Plus className="h-4 w-4" /> Add feed</div>
        <input
          placeholder="RSS URL"
          value={form.rss_url}
          onChange={(e) => setForm({ ...form, rss_url: e.target.value })}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          <input placeholder="Publisher" value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as typeof CATS[number] })} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
            {CATS.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
          </select>
          <select value={form.credibility} onChange={(e) => setForm({ ...form, credibility: e.target.value as typeof CREDS[number] })} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
            {CREDS.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <Button onClick={submitNew} disabled={adding} className="w-full rounded-xl">
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add feed"}
        </Button>
      </section>

      <section className="space-y-2">
        {feeds === null ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : feeds.length === 0 ? (
          <div className="text-sm text-muted-foreground">No feeds yet.</div>
        ) : feeds.map((f) => (
          <div key={f.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            {f.image_url ? <img src={f.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <div className="h-12 w-12 rounded-lg bg-accent" />}
            <div className="min-w-0 flex-1">
              <div className="truncate font-serif text-base">{f.title}</div>
              <div className="truncate text-[11px] text-muted-foreground">
                {f.publisher ? `${f.publisher} · ` : ""}{f.category.replace(/_/g, " ")} · {f.credibility.replace(/_/g, " ")}
                {f.last_synced_at ? ` · synced ${new Date(f.last_synced_at).toLocaleString()}` : " · not synced"}
              </div>
              {f.last_sync_error && <div className="truncate text-[11px] text-destructive">{f.last_sync_error}</div>}
            </div>
            <Switch checked={f.is_active} onCheckedChange={() => toggle(f)} />
            <Button size="sm" variant="ghost" onClick={() => runSync(f)} disabled={busy === f.id}>
              {busy === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Link to="/admin/podcasts/$feedId" params={{ feedId: f.id }} className="text-muted-foreground hover:text-foreground">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        ))}
      </section>
    </div>
  );
}
