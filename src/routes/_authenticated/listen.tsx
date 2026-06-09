import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Headphones, Plus, Trash2, Music, Mic2, Waves, ListMusic, BookOpen, Bookmark, Sparkles, TrendingUp, Clock } from "lucide-react";
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
import { TodayPick } from "@/components/listen/today-pick";
import { ReadRail } from "@/components/listen/read-rail";
import { SavedReadsList } from "@/components/listen/saved-reads-list";
import { ListenSearchBar } from "@/components/listen/search-bar";
import { ListenFilters, ActiveChipsBar, type Kind } from "@/components/listen/filter-chips";
import { SearchResults } from "@/components/listen/search-results";
import { CollectionsRail } from "@/components/listen/collections-rail";
import { HitsRail } from "@/components/listen/hits-rail";
import { SuggestContentDialog } from "@/components/listen/suggest-content-dialog";
import { searchListen, type SearchHit } from "@/lib/listen-search.functions";

const SearchSchema = z.object({
  tab: z.enum(["listen", "read", "yours"]).catch("listen"),
  q: z.string().max(120).catch(""),
  moods: z.string().catch(""),
  kinds: z.string().catch(""),
});

export const Route = createFileRoute("/_authenticated/listen")({
  component: ListenPage,
  validateSearch: SearchSchema,
  head: () => ({
    meta: [
      { title: "Listen & Read — Mental Health Walk Club" },
      { name: "description", content: "Podcasts, ambient mixes, articles, and your walking queues." },
    ],
  }),
});

type Playlist = { id: string; name: string; mood: string | null; is_public: boolean; item_count: number };

function fmtMins(s: number | null | undefined) {
  if (!s) return "—";
  const m = Math.round(s / 60);
  return `${m} min`;
}

function parseCsv(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

const ALL_KINDS: Kind[] = ["podcast", "ambient", "guided", "blog"];

function ListenPage() {
  const navigate = useNavigate();
  const { tab, q, moods: moodsStr, kinds: kindsStr } = useSearch({ from: "/_authenticated/listen" });
  const moods = useMemo(() => parseCsv(moodsStr), [moodsStr]);
  const kinds = useMemo(() => parseCsv(kindsStr).filter((k): k is Kind => (ALL_KINDS as string[]).includes(k)), [kindsStr]);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof listenCatalog>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [openFilters, setOpenFilters] = useState(false);
  const [openSuggest, setOpenSuggest] = useState(false);
  const [name, setName] = useState("");
  const [mood, setMood] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const runSearch = useServerFn(searchListen);

  const activeFilterCount = moods.length + kinds.length;
  const isSearching = q.trim().length > 0 || activeFilterCount > 0;

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

  // Run search whenever q/moods/kinds change and there's an active query/filter
  useEffect(() => {
    if (!isSearching) { setHits([]); return; }
    let alive = true;
    setSearching(true);
    runSearch({ data: { q, moods: moods.length ? moods : undefined, kinds: kinds.length ? kinds : undefined, limit: 24 } })
      .then((r) => { if (alive) setHits(r.hits); })
      .catch(() => { if (alive) setHits([]); })
      .finally(() => { if (alive) setSearching(false); });
    return () => { alive = false; };
  }, [q, moodsStr, kindsStr, isSearching, runSearch]);

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

  const updateSearch = (patch: Partial<{ tab: typeof tab; q: string; moods: string; kinds: string }>) =>
    navigate({ to: "/listen", search: (prev: z.infer<typeof SearchSchema>) => ({ ...prev, ...patch }), replace: true });

  const setTab = (t: "listen" | "read" | "yours") => updateSearch({ tab: t });

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <Link to="/profile" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back
      </Link>
      <header className="mb-5">
        <h1 className="flex items-center gap-2 font-serif text-3xl">
          <Headphones className="h-6 w-6 text-forest" /> Listen &amp; Read
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Something for every walk.</p>
      </header>

      {/* Today's pick — hidden while actively searching to focus on results */}
      {!isSearching && (
        loading || !catalog ? (
          <div className="mb-6 h-36 animate-pulse rounded-3xl bg-card" />
        ) : (
          <TodayPick pods={catalog.podcasts} ambient={catalog.ambient} guided={catalog.guided} />
        )
      )}

      <ListenSearchBar
        value={q}
        onChange={(v) => updateSearch({ q: v })}
        onOpenFilters={() => setOpenFilters(true)}
        activeFilterCount={activeFilterCount}
      />
      <ActiveChipsBar
        moods={moods}
        kinds={kinds}
        onRemoveMood={(m) => updateSearch({ moods: moods.filter((x) => x !== m).join(",") })}
        onRemoveKind={(k) => updateSearch({ kinds: kinds.filter((x) => x !== k).join(",") })}
      />
      <ListenFilters
        open={openFilters}
        onOpenChange={setOpenFilters}
        moods={moods}
        kinds={kinds}
        onChange={(next) => updateSearch({ moods: next.moods.join(","), kinds: next.kinds.join(",") })}
      />

      {isSearching ? (
        <Section title={`Results for “${q || "filters"}”`} icon={<Sparkles className="h-4 w-4 text-forest" />}>
          <SearchResults hits={hits} loading={searching} q={q} onSuggest={() => setOpenSuggest(true)} />
        </Section>
      ) : (
        <>
          <div className="mb-5 flex items-center justify-between gap-2">
            <div className="inline-flex rounded-full bg-secondary p-0.5 text-xs font-medium">
              {(["listen", "read", "yours"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 capitalize transition ${
                    tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {t === "listen" && <Headphones className="h-3 w-3" />}
                  {t === "read" && <BookOpen className="h-3 w-3" />}
                  {t === "yours" && <ListMusic className="h-3 w-3" />}
                  {t}
                </button>
              ))}
            </div>
            {tab === "yours" && (
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
            )}
          </div>

          {tab === "listen" && (
            <>
              <Section title="Curated collections" icon={<Sparkles className="h-4 w-4 text-forest" />}>
                <CollectionsRail />
              </Section>

              <Section title="Trending this week" icon={<TrendingUp className="h-4 w-4 text-forest" />}>
                <HitsRail mode="trending" />
              </Section>

              <Section title="Recently added" icon={<Clock className="h-4 w-4 text-forest" />}>
                <HitsRail mode="recent" />
              </Section>

              <Section title="Podcasts for walking" icon={<Mic2 className="h-4 w-4 text-forest" />}>
                {loading ? <RailSkeleton /> : (
                  <HorizontalRail>
                    {(catalog?.podcasts ?? []).map((e) => (
                      <Tile key={e.id} title={e.title} sub={fmtMins(e.duration_seconds)} cover={e.image_url ?? null} featured={!!e.is_featured} />
                    ))}
                  </HorizontalRail>
                )}
              </Section>

              <Section title="Ambient mixes" icon={<Waves className="h-4 w-4 text-forest" />}>
                {loading ? <RailSkeleton /> : (
                  <HorizontalRail>
                    {(catalog?.ambient ?? []).map((t) => (
                      <Tile key={t.id} title={t.title} sub={t.artist ?? fmtMins(t.duration_seconds)} cover={null} featured={!!t.is_featured} />
                    ))}
                  </HorizontalRail>
                )}
              </Section>

              <Section title="Guided walks" icon={<Music className="h-4 w-4 text-forest" />}>
                {loading ? <RailSkeleton /> : (
                  <HorizontalRail>
                    {(catalog?.guided ?? []).map((g) => (
                      <Tile key={g.id} title={g.title} sub={g.host ?? fmtMins(g.duration_seconds)} cover={g.cover_url ?? null} featured={!!g.is_featured} />
                    ))}
                  </HorizontalRail>
                )}
              </Section>

              <div className="mt-2 text-center">
                <button
                  type="button"
                  onClick={() => setOpenSuggest(true)}
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  Missing something? Suggest content
                </button>
              </div>
            </>
          )}

          {tab === "read" && (
            <>
              <Section title="Fresh from the blogs we follow" icon={<BookOpen className="h-4 w-4 text-forest" />}>
                <ReadRail />
              </Section>
              <Section title="Saved for later" icon={<Bookmark className="h-4 w-4 text-forest" />}>
                <SavedReadsList />
              </Section>
            </>
          )}

          {tab === "yours" && (
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
          )}
        </>
      )}

      <SuggestContentDialog open={openSuggest} onOpenChange={setOpenSuggest} prefill={q} />

      <p className="mt-10 text-center font-serif text-xs italic text-muted-foreground">
        Editor's notes update weekly.
      </p>
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

function RailSkeleton() {
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-52 w-40 shrink-0 animate-pulse rounded-2xl bg-card" />
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

function Tile({ title, sub, cover, featured }: { title: string; sub: string; cover: string | null; featured?: boolean }) {
  return (
    <div className="relative w-40 shrink-0 snap-start rounded-2xl border border-border bg-card p-2 shadow-soft">
      <div className="mb-2 aspect-square overflow-hidden rounded-xl bg-forest/10">
        {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : null}
      </div>
      {featured && (
        <span className="absolute right-3 top-3 rounded-full bg-forest/90 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-primary-foreground">
          Pick
        </span>
      )}
      <p className="truncate font-serif text-sm">{title}</p>
      <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}
