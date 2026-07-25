import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, TreePine, MapPin, Bookmark, BookmarkCheck, GripVertical, Trash2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import {
  discoverTrails,
  listMySavedTrails,
  saveTrail,
  unsaveTrail,
  reorderSavedTrails,
} from "@/lib/trails.functions";

export const Route = createFileRoute("/_authenticated/trails")({
  component: TrailsPage,
  head: () => ({
    meta: [
      { title: "Trails — Mental Health Walk Club" },
      { name: "description", content: "Parks and walking paths near you." },
    ],
  }),
});

type Trail = {
  id: string;
  name: string | null;
  kind: string | null;
  lat: number;
  lng: number;
  tags: Record<string, string> | null;
  length_m: number | null;
  miles?: number;
};

type Saved = {
  id: string;
  position: number;
  note: string | null;
  trail: Trail | null;
};

function TrailsPage() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<"asking" | "ok" | "denied">("asking");
  const [nearby, setNearby] = useState<Trail[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);

  const refreshSaved = useCallback(async () => {
    setLoadingSaved(true);
    const res = await listMySavedTrails();
    setSaved(res.saved as Saved[]);
    setLoadingSaved(false);
  }, []);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoState("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeoState("ok");
      },
      () => setGeoState("denied"),
      { maximumAge: 60_000, timeout: 5_000 },
    );
  }, []);

  useEffect(() => {
    if (!coords) return;
    setLoadingNearby(true);
    discoverTrails({ data: { lat: coords.lat, lng: coords.lng, limit: 20 } })
      .then((res) => setNearby(res.trails as Trail[]))
      .finally(() => setLoadingNearby(false));
  }, [coords]);

  const savedIds = new Set(saved.map((s) => s.trail?.id).filter(Boolean) as string[]);

  async function handleSave(trail_id: string) {
    try {
      await saveTrail({ data: { trail_id } });
      toast.success("Saved");
      refreshSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleUnsave(trail_id: string) {
    await unsaveTrail({ data: { trail_id } });
    refreshSaved();
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = saved.findIndex((s) => (s.trail?.id ?? s.id) === active.id);
    const newIdx = saved.findIndex((s) => (s.trail?.id ?? s.id) === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(saved, oldIdx, newIdx);
    setSaved(next);
    const ids = next.map((s) => s.trail?.id).filter(Boolean) as string[];
    await reorderSavedTrails({ data: { ids } });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <Link to="/" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to Discover
      </Link>
      <header className="mb-6">
        <div className="flex items-baseline gap-3">
          <h1 className="flex items-center gap-2 font-serif text-3xl">
            <TreePine className="h-6 w-6 text-moss-deep" />
            Trails
          </h1>
          <span className="font-hand text-xl text-rose-dust">find your green corner</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Parks and footpaths from OpenStreetMap. Save your favorites and reorder.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-2 font-serif text-lg">Saved</h2>
        {loadingSaved ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-card" />
            ))}
          </div>
        ) : saved.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border bg-card/60 p-5 text-center text-xs text-muted-foreground">
            Nothing saved yet. Tap the bookmark on a trail below.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={saved.map((s) => s.trail?.id ?? s.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-2">
                {saved.map((s) =>
                  s.trail ? (
                    <SortableRow
                      key={s.trail.id}
                      id={s.trail.id}
                      trail={s.trail}
                      onRemove={() => handleUnsave(s.trail!.id)}
                    />
                  ) : null,
                )}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-serif text-lg">Near you</h2>
        {geoState === "denied" && (
          <p className="mb-3 rounded-2xl border border-dashed border-border bg-card/60 p-3 text-xs text-muted-foreground">
            Turn on location to see trails within 25 miles.
          </p>
        )}
        {loadingNearby ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-card" />
            ))}
          </div>
        ) : nearby.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border bg-card/60 p-5 text-center text-xs text-muted-foreground">
            {coords ? "No trails found nearby yet." : "Waiting for location…"}
          </p>
        ) : (
          <ul className="space-y-2">
            {nearby.map((t) => (
              <li key={t.id}>
                <TrailCard
                  trail={t}
                  saved={savedIds.has(t.id)}
                  onSave={() => handleSave(t.id)}
                  onUnsave={() => handleUnsave(t.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TrailCard({
  trail,
  saved,
  onSave,
  onUnsave,
}: {
  trail: Trail;
  saved: boolean;
  onSave: () => void;
  onUnsave: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-3xl border border-border bg-card p-4 shadow-soft">
      <Link
        to="/trails/$id"
        params={{ id: trail.id }}
        className="min-w-0 flex-1 -m-1 rounded-2xl p-1 hover:bg-accent/20"
      >
        <h3 className="truncate font-serif text-base">{trail.name ?? "Unnamed"}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-full bg-forest/10 px-1.5 py-0.5 text-forest">{trail.kind ?? "trail"}</span>
          {trail.miles != null && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {trail.miles.toFixed(1)} mi
            </span>
          )}
          {trail.tags?.surface && <span>· {trail.tags.surface}</span>}
        </div>
      </Link>
      <button
        type="button"
        onClick={saved ? onUnsave : onSave}
        className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
        aria-label={saved ? "Remove from saved" : "Save trail"}
      >
        {saved ? <BookmarkCheck className="h-4 w-4 text-forest" /> : <Bookmark className="h-4 w-4" />}
      </button>
    </div>
  );
}

function SortableRow({ id, trail, onRemove }: { id: string; trail: Trail; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-3xl border border-border bg-card p-3 shadow-soft"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded p-1 text-muted-foreground active:cursor-grabbing"
        aria-label="Reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Link to="/trails/$id" params={{ id: trail.id }} className="min-w-0 flex-1 -m-1 rounded-2xl p-1 hover:bg-accent/20">
        <p className="truncate font-serif text-sm">{trail.name ?? "Unnamed"}</p>
        <p className="text-[11px] text-muted-foreground">{trail.kind ?? "trail"}</p>
      </Link>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label="Remove"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
