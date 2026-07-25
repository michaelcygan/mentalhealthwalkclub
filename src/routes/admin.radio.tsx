import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Radio, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminListStations, adminUpsertStation, adminDeleteStation } from "@/lib/radio.functions";

export const Route = createFileRoute("/admin/radio")({
  component: AdminRadio,
  head: () => ({ meta: [{ title: "Admin — Radio" }] }),
});

interface Station {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  cover_url: string | null;
  is_active: boolean;
  sort: number;
}

function AdminRadio() {
  const list = useServerFn(adminListStations);
  const upsert = useServerFn(adminUpsertStation);
  const remove = useServerFn(adminDeleteStation);
  const [stations, setStations] = useState<Station[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ slug: "", title: "", subtitle: "" });

  const load = async () => {
    try { setStations((await list()) as Station[]); } catch (e) { toast.error(String(e)); }
  };
  useEffect(() => { load(); }, []);

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
    if (!confirm("Delete this station and all its tracks?")) return;
    try { await remove({ data: { id } }); await load(); toast.success("Deleted"); } catch (e) { toast.error(String(e)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-serif text-xl"><Radio className="h-4 w-4 text-forest" /> Radio stations</h2>
        <Button size="sm" onClick={() => setCreating((v) => !v)}><Plus className="mr-1 h-3.5 w-3.5" /> New</Button>
      </div>
      {creating && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <Input placeholder="slug (e.g. forest-loop)" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <Input placeholder="Subtitle (optional)" value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} />
          <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button><Button size="sm" onClick={create}>Create</Button></div>
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
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{s.title} <span className="text-xs text-muted-foreground">/{s.slug}</span></p>
                {s.subtitle && <p className="truncate text-xs text-muted-foreground">{s.subtitle}</p>}
                <p className="text-[10px] text-muted-foreground">{s.is_active ? "Active" : "Hidden"}</p>
              </div>
              <Link to="/admin/radio/$id" params={{ id: s.id }} className="rounded-full bg-secondary px-3 py-1 text-xs">Edit <ChevronRight className="inline h-3 w-3" /></Link>
              <button onClick={() => del(s.id)} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
