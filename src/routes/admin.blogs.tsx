import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, RefreshCw, Trash2, Plus, BookOpen, Inbox, Check, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  listBlogFeedsAdmin, createBlogFeed, toggleBlogFeed, deleteBlogFeed, syncBlogFeedsAdmin,
} from "@/lib/blog-feeds.functions";
import { adminListContentRequests, adminUpdateContentRequest } from "@/lib/content-suggestions.functions";

export const Route = createFileRoute("/admin/blogs")({ component: AdminBlogs });

interface Feed {
  id: string;
  rss_url: string;
  title: string;
  publisher: string | null;
  is_active: boolean;
  last_synced_at: string | null;
  last_sync_error: string | null;
  image_url: string | null;
}

function AdminBlogs() {
  const [feeds, setFeeds] = useState<Feed[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ rss_url: "", title: "", publisher: "" });
  const list = useServerFn(listBlogFeedsAdmin);
  const create = useServerFn(createBlogFeed);
  const toggle = useServerFn(toggleBlogFeed);
  const remove = useServerFn(deleteBlogFeed);
  const syncAll = useServerFn(syncBlogFeedsAdmin);

  const load = async () => {
    try {
      const data = await list();
      setFeeds(data as Feed[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    }
  };
  useEffect(() => { load(); }, []);

  const handleSyncAll = async () => {
    setBusy(true);
    try {
      const r = await syncAll();
      toast.success(`Synced ${r.ok}/${r.scanned} feeds${r.failed ? ` · ${r.failed} failed` : ""}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally { setBusy(false); }
  };

  const submitNew = async () => {
    if (!form.rss_url || !form.title) { toast.error("URL and title required"); return; }
    setAdding(true);
    try {
      await create({ data: { rss_url: form.rss_url, title: form.title, publisher: form.publisher || undefined } });
      toast.success("Feed added");
      setForm({ rss_url: "", title: "", publisher: "" });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Add failed");
    } finally { setAdding(false); }
  };

  const onToggle = async (f: Feed) => {
    await toggle({ data: { id: f.id, is_active: !f.is_active } });
    load();
  };

  const onDelete = async (f: Feed) => {
    if (!confirm(`Delete "${f.title}"? This also deletes its posts.`)) return;
    await remove({ data: { id: f.id } });
    load();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-serif text-lg"><BookOpen className="h-4 w-4" /> Blog feeds</div>
          <Button size="sm" variant="outline" onClick={handleSyncAll} disabled={busy} className="rounded-full">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1">Sync all</span>
          </Button>
        </div>
        <div className="space-y-2">
          <input
            placeholder="RSS URL"
            value={form.rss_url}
            onChange={(e) => setForm({ ...form, rss_url: e.target.value })}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            <input placeholder="Publisher" value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <Button onClick={submitNew} disabled={adding} className="w-full rounded-xl">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1 h-4 w-4" />Add feed</>}
          </Button>
        </div>
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
                {f.publisher ? `${f.publisher} · ` : ""}
                {f.last_synced_at ? `synced ${new Date(f.last_synced_at).toLocaleString()}` : "not synced"}
              </div>
              {f.last_sync_error && <div className="truncate text-[11px] text-destructive">{f.last_sync_error}</div>}
            </div>
            <Switch checked={f.is_active} onCheckedChange={() => onToggle(f)} />
            <button
              type="button"
              onClick={() => onDelete(f)}
              aria-label="Delete"
              className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </section>

      <SuggestionsInbox />
    </div>
  );
}

type Suggestion = { id: string; title: string; url: string | null; kind: string; notes: string | null; status: string; created_at: string };

function SuggestionsInbox() {
  const [rows, setRows] = useState<Suggestion[] | null>(null);
  const [filter, setFilter] = useState<"open" | "in_review" | "approved" | "declined" | "all">("open");
  const list = useServerFn(adminListContentRequests);
  const update = useServerFn(adminUpdateContentRequest);

  const load = async () => {
    try { const r = await list({ data: { status: filter } }); setRows(r as Suggestion[]); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Load failed"); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const setStatus = async (id: string, status: "in_review" | "approved" | "declined") => {
    await update({ data: { id, status } });
    load();
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-serif text-lg"><Inbox className="h-4 w-4" /> Suggestions inbox</div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="rounded-full border border-border bg-background px-2 py-1 text-xs">
          <option value="open">Open</option>
          <option value="in_review">In review</option>
          <option value="approved">Approved</option>
          <option value="declined">Declined</option>
          <option value="all">All</option>
        </select>
      </div>
      {rows === null ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">Nothing here.</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-start gap-2">
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] capitalize">{r.kind}</span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-serif text-sm">{r.title}</p>
                  {r.notes && <p className="line-clamp-2 text-[11px] text-muted-foreground">{r.notes}</p>}
                  <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()} · {r.status}</p>
                </div>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="rounded-full p-1.5 text-muted-foreground hover:text-foreground" aria-label="Open">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              {r.status !== "approved" && r.status !== "declined" && (
                <div className="mt-2 flex gap-1.5">
                  {r.status !== "in_review" && (
                    <Button size="sm" variant="outline" className="h-7 rounded-full text-[11px]" onClick={() => setStatus(r.id, "in_review")}>Review</Button>
                  )}
                  <Button size="sm" className="h-7 rounded-full text-[11px]" onClick={() => setStatus(r.id, "approved")}>
                    <Check className="mr-1 h-3 w-3" /> Approve
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 rounded-full text-[11px]" onClick={() => setStatus(r.id, "declined")}>
                    <X className="mr-1 h-3 w-3" /> Decline
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
