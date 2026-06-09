import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import {
  listCollections, adminUpsertCollection, adminDeleteCollection,
  adminAddCollectionItem, adminRemoveCollectionItem, getCollectionBySlug,
  type CollectionCard,
} from "@/lib/collections.functions";

export const Route = createFileRoute("/admin/collections")({ component: AdminCollections });

type Kind = "podcast" | "ambient" | "guided" | "blog";

function AdminCollections() {
  const [items, setItems] = useState<CollectionCard[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ slug: "", name: "", blurb: "", cover_url: "", is_published: false });
  const list = useServerFn(listCollections);
  const upsert = useServerFn(adminUpsertCollection);
  const remove = useServerFn(adminDeleteCollection);

  const load = async () => {
    try { const data = await list({ data: { include_drafts: true } }); setItems(data); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Load failed"); }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.slug || !form.name) { toast.error("Slug and name required"); return; }
    setBusy(true);
    try {
      await upsert({ data: { slug: form.slug, name: form.name, blurb: form.blurb || undefined, cover_url: form.cover_url || undefined, is_published: form.is_published, sort_order: 100 } });
      toast.success("Saved");
      setForm({ slug: "", name: "", blurb: "", cover_url: "", is_published: false });
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  };

  const onDelete = async (c: CollectionCard) => {
    if (!confirm(`Delete "${c.name}"?`)) return;
    await remove({ data: { id: c.id } });
    load();
  };

  const onTogglePublish = async (c: CollectionCard) => {
    await upsert({ data: { id: c.id, slug: c.slug, name: c.name, blurb: c.blurb ?? undefined, cover_url: c.cover_url ?? undefined, is_published: !c.is_published, sort_order: 100 } });
    load();
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 font-serif text-lg"><Sparkles className="h-4 w-4" /> New collection</div>
        <Input placeholder="Slug (e.g. morning-reset)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input placeholder="Blurb (optional)" value={form.blurb} onChange={(e) => setForm({ ...form, blurb: e.target.value })} />
        <Input placeholder="Cover URL (optional)" value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} />
        <div className="flex items-center justify-between rounded-xl border border-border p-3">
          <div>
            <p className="text-sm">Published</p>
            <p className="text-xs text-muted-foreground">Visible to members on Listen.</p>
          </div>
          <Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
        </div>
        <Button onClick={submit} disabled={busy} className="w-full rounded-xl">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1 h-4 w-4" /> Create</>}
        </Button>
      </section>

      <section className="space-y-2">
        {items === null ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No collections yet.</div>
        ) : items.map((c) => (
          <CollectionRow key={c.id} c={c} onDelete={onDelete} onTogglePublish={onTogglePublish} onChange={load} />
        ))}
      </section>
    </div>
  );
}

function CollectionRow({ c, onDelete, onTogglePublish, onChange }: {
  c: CollectionCard;
  onDelete: (c: CollectionCard) => void;
  onTogglePublish: (c: CollectionCard) => void;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Array<{ id: string; kind: Kind; item_id: string }> | null>(null);
  const [newItem, setNewItem] = useState<{ kind: Kind; item_id: string }>({ kind: "podcast", item_id: "" });
  const fetchOne = useServerFn(getCollectionBySlug);
  const add = useServerFn(adminAddCollectionItem);
  const removeItem = useServerFn(adminRemoveCollectionItem);

  const load = async () => {
    const r = await fetchOne({ data: { slug: c.slug } });
    setItems(r.items as Array<{ id: string; kind: Kind; item_id: string }>);
  };
  useEffect(() => { if (open && items === null) load(); }, [open]);

  const onAdd = async () => {
    if (!newItem.item_id) { toast.error("Paste an item UUID"); return; }
    try {
      await add({ data: { collection_id: c.id, kind: newItem.kind, item_id: newItem.item_id } });
      setNewItem({ kind: newItem.kind, item_id: "" });
      load(); onChange();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Add failed"); }
  };

  const onRemove = async (id: string) => {
    await removeItem({ data: { id } });
    load(); onChange();
  };

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-3 p-3">
        <button onClick={() => setOpen((v) => !v)} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Expand">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {c.cover_url ? <img src={c.cover_url} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="h-10 w-10 rounded-lg bg-accent" />}
        <div className="min-w-0 flex-1">
          <div className="truncate font-serif text-base">{c.name}</div>
          <div className="truncate text-[11px] text-muted-foreground">/{c.slug} · {c.item_count} items{c.is_published ? "" : " · draft"}</div>
        </div>
        <Switch checked={c.is_published} onCheckedChange={() => onTogglePublish(c)} />
        <button type="button" onClick={() => onDelete(c)} aria-label="Delete" className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-border p-3">
          {items === null ? (
            <div className="text-xs text-muted-foreground">Loading items…</div>
          ) : items.length === 0 ? (
            <div className="text-xs text-muted-foreground">No items yet.</div>
          ) : (
            <ul className="space-y-1">
              {items.map((it) => (
                <li key={it.id} className="flex items-center gap-2 rounded-lg bg-background px-2 py-1 text-xs">
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] capitalize">{it.kind}</span>
                  <code className="flex-1 truncate text-[10px] text-muted-foreground">{it.item_id}</code>
                  <button onClick={() => onRemove(it.id)} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <select
              value={newItem.kind}
              onChange={(e) => setNewItem({ ...newItem, kind: e.target.value as Kind })}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
            >
              <option value="podcast">Podcast</option>
              <option value="ambient">Ambient</option>
              <option value="guided">Guided</option>
              <option value="blog">Blog</option>
            </select>
            <Input placeholder="Item UUID" value={newItem.item_id} onChange={(e) => setNewItem({ ...newItem, item_id: e.target.value })} className="text-xs" />
            <Button size="sm" onClick={onAdd} className="rounded-full"><Plus className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
