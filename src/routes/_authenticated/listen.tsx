import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Headphones, Plus, Trash2, Music, Mic2, Waves, ListMusic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  listMyPlaylists, createPlaylist, deletePlaylist, listenCatalog,
} from "@/lib/playlists.functions";

export const Route = createFileRoute("/_authenticated/listen")({
  component: ListenPage,
  head: () => ({
    meta: [
      { title: "Listen — Mental Health Walk Club" },
      { name: "description", content: "Podcasts, ambient mixes and your walk playlists." },
    ],
  }),
});

type Playlist = { id: string; name: string; mood: string | null; is_public: boolean; item_count: number };

function fmtMins(s: number | null | undefined) {
  if (!s) return "—";
  const m = Math.round(s / 60);
  return `${m} min`;
}

function ListenPage() {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof listenCatalog>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [name, setName] = useState("");
  const [mood, setMood] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [pl, cat] = await Promise.all([listMyPlaylists(), listenCatalog()]);
      setPlaylists(pl.playlists as Playlist[]);
      setCatalog(cat);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      const { id } = await createPlaylist({ data: { name: name.trim(), mood: mood.trim() || undefined, is_public: isPublic } });
      toast.success("Playlist created");
      setOpenCreate(false);
      setName(""); setMood(""); setIsPublic(false);
      navigate({ to: "/listen/$id", params: { id } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this playlist?")) return;
    await deletePlaylist({ data: { id } });
    refresh();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <Link to="/profile" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back
      </Link>
      <header className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-serif text-3xl">
            <Headphones className="h-6 w-6 text-forest" /> Listen
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Podcasts, ambient mixes, and your walking queues.</p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-full"><Plus className="mr-1 h-4 w-4" /> Playlist</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New playlist</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="pl-name">Name</Label>
                <Input id="pl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Morning reset" />
              </div>
              <div>
                <Label htmlFor="pl-mood">Mood (optional)</Label>
                <Input id="pl-mood" value={mood} onChange={(e) => setMood(e.target.value)} placeholder="calm, focus, uplift…" />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border p-3">
                <div>
                  <p className="text-sm">Public</p>
                  <p className="text-xs text-muted-foreground">Others can view and add to their queue.</p>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} className="rounded-full">Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <Section title="Your queue" icon={<ListMusic className="h-4 w-4 text-forest" />}>
        {loading ? (
          <Skeleton n={2} />
        ) : playlists.length === 0 ? (
          <Empty text="No playlists yet. Build one to soundtrack your next walk." />
        ) : (
          <ul className="space-y-2">
            {playlists.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-3xl border border-border bg-card p-4 shadow-soft">
                <Link to="/listen/$id" params={{ id: p.id }} className="min-w-0 flex-1 -m-1 rounded-2xl p-1 hover:bg-accent/20">
                  <p className="truncate font-serif text-base">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.item_count} {p.item_count === 1 ? "track" : "tracks"}
                    {p.mood && ` · ${p.mood}`}
                    {p.is_public && " · public"}
                  </p>
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Podcasts for walking" icon={<Mic2 className="h-4 w-4 text-forest" />}>
        {loading ? <Skeleton n={3} /> : (
          <HorizontalRail>
            {(catalog?.podcasts ?? []).map((e) => (
              <Tile key={e.id} title={e.title} sub={fmtMins(e.duration_seconds)} cover={e.image_url ?? null} />
            ))}
          </HorizontalRail>
        )}
      </Section>

      <Section title="Ambient mixes" icon={<Waves className="h-4 w-4 text-forest" />}>
        {loading ? <Skeleton n={3} /> : (
          <HorizontalRail>
            {(catalog?.ambient ?? []).map((t) => (
              <Tile key={t.id} title={t.title} sub={t.artist ?? fmtMins(t.duration_seconds)} cover={null} />
            ))}
          </HorizontalRail>
        )}
      </Section>

      <Section title="Guided walks" icon={<Music className="h-4 w-4 text-forest" />}>
        {loading ? <Skeleton n={3} /> : (
          <HorizontalRail>
            {(catalog?.guided ?? []).map((g) => (
              <Tile key={g.id} title={g.title} sub={g.host ?? fmtMins(g.duration_seconds)} cover={g.cover_url ?? null} />
            ))}
          </HorizontalRail>
        )}
      </Section>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 flex items-center gap-2 font-serif text-lg">{icon}{title}</h2>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-3xl border border-dashed border-border bg-card/60 p-5 text-center text-xs text-muted-foreground">{text}</p>
  );
}

function Skeleton({ n }: { n: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-card" />
      ))}
    </div>
  );
}

function HorizontalRail({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
      {children}
    </div>
  );
}

function Tile({ title, sub, cover }: { title: string; sub: string; cover: string | null }) {
  return (
    <div className="w-40 shrink-0 snap-start rounded-2xl border border-border bg-card p-2 shadow-soft">
      <div className="mb-2 aspect-square overflow-hidden rounded-xl bg-forest/10">
        {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : null}
      </div>
      <p className="truncate font-serif text-sm">{title}</p>
      <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}
