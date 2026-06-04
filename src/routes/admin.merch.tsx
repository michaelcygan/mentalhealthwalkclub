import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListAllProducts,
  adminUpsertMerchProduct,
  adminDeleteMerchProduct,
} from "@/lib/merch.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/merch")({ component: AdminMerch });

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  image_url: string | null;
  inventory: number | null;
  is_active: boolean;
  sort: number;
}

const empty = {
  slug: "",
  name: "",
  description: "",
  price_cents: 2500,
  currency: "usd",
  image_url: "",
  inventory: null as number | null,
  is_active: true,
  sort: 0,
};

function AdminMerch() {
  const listAll = useServerFn(adminListAllProducts);
  const upsert = useServerFn(adminUpsertMerchProduct);
  const del = useServerFn(adminDeleteMerchProduct);
  const [items, setItems] = useState<Product[] | null>(null);
  const [editing, setEditing] = useState<Record<string, Partial<Product>>>({});
  const [newForm, setNewForm] = useState(empty);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const rows = await listAll();
    setItems(rows as Product[]);
  };
  useEffect(() => { load(); }, []);

  const saveRow = async (p: Product) => {
    const edits = editing[p.id] ?? {};
    setBusy(p.id);
    try {
      await upsert({
        data: {
          id: p.id,
          slug: (edits.slug ?? p.slug) as string,
          name: (edits.name ?? p.name) as string,
          description: (edits.description ?? p.description) as string | null,
          price_cents: (edits.price_cents ?? p.price_cents) as number,
          currency: (edits.currency ?? p.currency) as string,
          image_url: (edits.image_url ?? p.image_url) as string | null,
          inventory: (edits.inventory ?? p.inventory) as number | null,
          is_active: (edits.is_active ?? p.is_active) as boolean,
          sort: (edits.sort ?? p.sort) as number,
        },
      });
      toast.success("Saved");
      setEditing((e) => { const c = { ...e }; delete c[p.id]; return c; });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  };

  const removeRow = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    setBusy(p.id);
    try {
      await del({ data: { id: p.id } });
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  };

  const createNew = async () => {
    if (!newForm.slug || !newForm.name) {
      toast.error("Slug and name required");
      return;
    }
    setBusy("new");
    try {
      await upsert({
        data: {
          slug: newForm.slug,
          name: newForm.name,
          description: newForm.description || null,
          price_cents: newForm.price_cents,
          currency: newForm.currency,
          image_url: newForm.image_url || null,
          inventory: newForm.inventory,
          is_active: newForm.is_active,
          sort: newForm.sort,
        },
      });
      toast.success("Created");
      setNewForm(empty);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(null);
    }
  };

  const patch = (id: string, key: keyof Product, value: unknown) =>
    setEditing((e) => ({ ...e, [id]: { ...e[id], [key]: value } }));

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 font-serif text-lg">
          <Plus className="h-4 w-4" /> Add product
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="slug (e.g. walk-tee)"
            value={newForm.slug}
            onChange={(e) => setNewForm({ ...newForm, slug: e.target.value })}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            placeholder="Name"
            value={newForm.name}
            onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="number"
            placeholder="Price (cents)"
            value={newForm.price_cents}
            onChange={(e) => setNewForm({ ...newForm, price_cents: parseInt(e.target.value || "0") })}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            placeholder="Currency"
            value={newForm.currency}
            onChange={(e) => setNewForm({ ...newForm, currency: e.target.value })}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            placeholder="Image URL"
            value={newForm.image_url}
            onChange={(e) => setNewForm({ ...newForm, image_url: e.target.value })}
            className="col-span-2 rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Description"
            value={newForm.description}
            onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
            className="col-span-2 min-h-[60px] rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="number"
            placeholder="Inventory (blank = unlimited)"
            value={newForm.inventory ?? ""}
            onChange={(e) => setNewForm({ ...newForm, inventory: e.target.value ? parseInt(e.target.value) : null })}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="number"
            placeholder="Sort"
            value={newForm.sort}
            onChange={(e) => setNewForm({ ...newForm, sort: parseInt(e.target.value || "0") })}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <Button onClick={createNew} disabled={busy === "new"} className="w-full rounded-xl">
          {busy === "new" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add product"}
        </Button>
      </section>

      <section className="space-y-2">
        {items === null ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No products yet.</div>
        ) : items.map((p) => {
          const e = editing[p.id] ?? {};
          const dirty = Object.keys(e).length > 0;
          return (
            <div key={p.id} className="space-y-2 rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center gap-3">
                {(e.image_url ?? p.image_url) ? (
                  <img src={(e.image_url ?? p.image_url) as string} alt="" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-accent" />
                )}
                <input
                  defaultValue={p.name}
                  onChange={(ev) => patch(p.id, "name", ev.target.value)}
                  className="flex-1 rounded-xl border border-border bg-background px-2 py-1.5 text-sm"
                />
                <Switch
                  checked={(e.is_active ?? p.is_active) as boolean}
                  onCheckedChange={(v) => patch(p.id, "is_active", v)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  defaultValue={p.slug}
                  onChange={(ev) => patch(p.id, "slug", ev.target.value)}
                  placeholder="slug"
                  className="rounded-xl border border-border bg-background px-2 py-1.5 text-xs"
                />
                <input
                  type="number"
                  defaultValue={p.price_cents}
                  onChange={(ev) => patch(p.id, "price_cents", parseInt(ev.target.value || "0"))}
                  placeholder="cents"
                  className="rounded-xl border border-border bg-background px-2 py-1.5 text-xs"
                />
                <input
                  defaultValue={p.image_url ?? ""}
                  onChange={(ev) => patch(p.id, "image_url", ev.target.value)}
                  placeholder="image url"
                  className="col-span-2 rounded-xl border border-border bg-background px-2 py-1.5 text-xs"
                />
                <textarea
                  defaultValue={p.description ?? ""}
                  onChange={(ev) => patch(p.id, "description", ev.target.value)}
                  placeholder="description"
                  className="col-span-2 min-h-[50px] rounded-xl border border-border bg-background px-2 py-1.5 text-xs"
                />
                <input
                  type="number"
                  defaultValue={p.inventory ?? ""}
                  onChange={(ev) => patch(p.id, "inventory", ev.target.value ? parseInt(ev.target.value) : null)}
                  placeholder="inventory"
                  className="rounded-xl border border-border bg-background px-2 py-1.5 text-xs"
                />
                <input
                  type="number"
                  defaultValue={p.sort}
                  onChange={(ev) => patch(p.id, "sort", parseInt(ev.target.value || "0"))}
                  placeholder="sort"
                  className="rounded-xl border border-border bg-background px-2 py-1.5 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => removeRow(p)} disabled={busy === p.id}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={() => saveRow(p)} disabled={!dirty || busy === p.id}>
                  {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-1 h-3.5 w-3.5" /> Save</>}
                </Button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
