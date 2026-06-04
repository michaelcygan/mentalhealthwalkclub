import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, Plus, Trash2, GripVertical, Music, Mic2, Waves } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getPlaylist, addPlaylistItem, removePlaylistItem, reorderPlaylistItems, listenCatalog,
} from "@/lib/playlists.functions";

export const Route = createFileRoute("/_authenticated/listen/$id")({
  component: PlaylistDetail,
  head: () => ({ meta: [{ title: "Playlist — Mental Health Walk Club" }] }),
});

type Kind = "podcast_episode" | "ambient_track" | "guided_track";
type Item = {
  id: string;
  position: number;
  kind: Kind;
  track_id: string;
  meta: { id: string; title: string; duration_seconds?: number; image_url?: string | null; cover_path?: string | null; cover_url?: string | null; artist?: string | null; host?: string | null } | null;
};

function fmtMins(s: number | null | undefined) {
  if (!s) return "—";
  return `${Math.round(s / 60)} min`;
}

function PlaylistDetail() {
  const { id } = Route.useParams();
  const [pl, setPl] = useState<{ id: string; name: string; mood: string | null } | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof listenCatalog>> | null>(null);
  const [openAdd, setOpenAdd] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPlaylist({ data: { id } });
      setPl(res.playlist as { id: string; name: string; mood: string | null });
      setItems(res.items as Item[]);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!openAdd) return;
    if (catalog) return;
    listenCatalog().then(setCatalog);
  }, [openAdd, catalog]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(items, oldIdx, newIdx);
    setItems(next);
    await reorderPlaylistItems({ data: { playlist_id: id, ids: next.map((i) => i.id) } });
  }

  async function handleAdd(kind: Kind, track_id: string) {
    try {
      await addPlaylistItem({ data: { playlist_id: id, kind, track_id } });
      toast.success("Added");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleRemove(itemId: string) {
    await removePlaylistItem({ data: { id: itemId } });
    setItems((s) => s.filter((i) => i.id !== itemId));
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <Link to="/listen" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to Listen
      </Link>
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">{pl?.name ?? "Playlist"}</h1>
          {pl?.mood && <p className="text-xs text-muted-foreground">{pl.mood}</p>}
        </div>
        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-full"><Plus className="mr-1 h-4 w-4" /> Add</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add to playlist</DialogTitle></DialogHeader>
            <Tabs defaultValue="podcast">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="podcast"><Mic2 className="mr-1 h-3 w-3" />Podcasts</TabsTrigger>
                <TabsTrigger value="ambient"><Waves className="mr-1 h-3 w-3" />Ambient</TabsTrigger>
                <TabsTrigger value="guided"><Music className="mr-1 h-3 w-3" />Guided</TabsTrigger>
              </TabsList>
              <TabsContent value="podcast" className="max-h-80 overflow-y-auto">
                <CatalogList
                  rows={(catalog?.podcasts ?? []).map((r) => ({ id: r.id, title: r.title, sub: fmtMins(r.duration_seconds) }))}
                  onAdd={(tid) => handleAdd("podcast_episode", tid)}
                />
              </TabsContent>
              <TabsContent value="ambient" className="max-h-80 overflow-y-auto">
                <CatalogList
                  rows={(catalog?.ambient ?? []).map((r) => ({ id: r.id, title: r.title, sub: r.artist ?? fmtMins(r.duration_seconds) }))}
                  onAdd={(tid) => handleAdd("ambient_track", tid)}
                />
              </TabsContent>
              <TabsContent value="guided" className="max-h-80 overflow-y-auto">
                <CatalogList
                  rows={(catalog?.guided ?? []).map((r) => ({ id: r.id, title: r.title, sub: r.host ?? fmtMins(r.duration_seconds) }))}
                  onAdd={(tid) => handleAdd("guided_track", tid)}
                />
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </header>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-card" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border bg-card/60 p-5 text-center text-xs text-muted-foreground">
          Empty playlist. Tap Add to bring in tracks.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {items.map((it) => (
                <SortableItem key={it.id} item={it} onRemove={() => handleRemove(it.id)} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function CatalogList({ rows, onAdd }: { rows: { id: string; title: string; sub: string }[]; onAdd: (id: string) => void }) {
  if (rows.length === 0) return <p className="py-6 text-center text-xs text-muted-foreground">No tracks available.</p>;
  return (
    <ul className="space-y-1 pt-2">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-2">
          <div className="min-w-0">
            <p className="truncate text-sm">{r.title}</p>
            <p className="truncate text-[11px] text-muted-foreground">{r.sub}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => onAdd(r.id)}><Plus className="h-3 w-3" /></Button>
        </li>
      ))}
    </ul>
  );
}

function SortableItem({ item, onRemove }: { item: Item; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const m = item.meta;
  const sub =
    item.kind === "podcast_episode" ? fmtMins(m?.duration_seconds) :
    item.kind === "ambient_track" ? (m?.artist ?? fmtMins(m?.duration_seconds)) :
    (m?.host ?? fmtMins(m?.duration_seconds));
  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-3xl border border-border bg-card p-3 shadow-soft">
      <button {...attributes} {...listeners} type="button" className="cursor-grab touch-none rounded p-1 text-muted-foreground active:cursor-grabbing" aria-label="Reorder">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-sm">{m?.title ?? "Untitled"}</p>
        <p className="truncate text-[11px] text-muted-foreground">{item.kind.replace("_", " ")} · {sub}</p>
      </div>
      <button onClick={onRemove} type="button" className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Remove">
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
