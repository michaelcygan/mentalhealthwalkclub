import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Sparkles, Headphones, Waves, Music, BookOpen, ExternalLink } from "lucide-react";
import { getCollectionBySlug } from "@/lib/collections.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/listen/collection/$slug")({
  component: CollectionPage,
});

type Kind = "podcast" | "ambient" | "guided" | "blog";
type ItemRow = { id: string; kind: Kind; item_id: string; position: number };
type Hydrated = { id: string; kind: Kind; title: string; subtitle: string | null; cover: string | null; link: string | null };

const KIND_ICON: Record<Kind, typeof Headphones> = {
  podcast: Headphones, ambient: Waves, guided: Music, blog: BookOpen,
};

function CollectionPage() {
  const { slug } = Route.useParams();
  const fetchCollection = useServerFn(getCollectionBySlug);
  const [data, setData] = useState<{ name: string; blurb: string | null; cover_url: string | null } | null>(null);
  const [items, setItems] = useState<Hydrated[] | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetchCollection({ data: { slug } });
        if (!alive) return;
        if (!r.collection) { setMissing(true); return; }
        setData({ name: r.collection.name, blurb: r.collection.blurb, cover_url: r.collection.cover_url });
        const rows = r.items as ItemRow[];
        const byKind: Record<Kind, string[]> = { podcast: [], ambient: [], guided: [], blog: [] };
        for (const it of rows) byKind[it.kind].push(it.item_id);
        const [pods, amb, gd, bl] = await Promise.all([
          byKind.podcast.length ? supabase.from("podcast_episodes").select("id,title,image_url,episode_url").in("id", byKind.podcast) : Promise.resolve({ data: [] }),
          byKind.ambient.length ? supabase.from("ambient_tracks").select("id,title,artist,cover_path").in("id", byKind.ambient) : Promise.resolve({ data: [] }),
          byKind.guided.length ? supabase.from("guided_tracks").select("id,title,host,cover_url").in("id", byKind.guided) : Promise.resolve({ data: [] }),
          byKind.blog.length ? supabase.from("blog_posts").select("id,title,image_url,link").in("id", byKind.blog) : Promise.resolve({ data: [] }),
        ]);
        const map = new Map<string, Hydrated>();
        for (const r of (pods.data ?? []) as any[]) map.set(`podcast:${r.id}`, { id: r.id, kind: "podcast", title: r.title, subtitle: null, cover: r.image_url, link: r.episode_url });
        for (const r of (amb.data ?? []) as any[]) map.set(`ambient:${r.id}`, { id: r.id, kind: "ambient", title: r.title, subtitle: r.artist, cover: r.cover_path, link: null });
        for (const r of (gd.data ?? []) as any[]) map.set(`guided:${r.id}`, { id: r.id, kind: "guided", title: r.title, subtitle: r.host, cover: r.cover_url, link: null });
        for (const r of (bl.data ?? []) as any[]) map.set(`blog:${r.id}`, { id: r.id, kind: "blog", title: r.title, subtitle: null, cover: r.image_url, link: r.link });
        const ordered = rows.map((it) => map.get(`${it.kind}:${it.item_id}`)).filter(Boolean) as Hydrated[];
        if (alive) setItems(ordered);
      } catch { if (alive) setMissing(true); }
    })();
    return () => { alive = false; };
  }, [slug, fetchCollection]);

  if (missing) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <Link to="/listen" search={{ tab: "listen", q: "", moods: "", kinds: "" }} className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back
        </Link>
        <p className="rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">Collection not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <Link to="/listen" search={{ tab: "listen", q: "", moods: "", kinds: "" }} className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to Listen
      </Link>
      <header className="relative mb-6 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-forest/20 via-card to-card p-5 shadow-soft">
        {data?.cover_url ? <img src={data.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" /> : null}
        <div className="relative">
          <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-forest backdrop-blur">
            <Sparkles className="h-2.5 w-2.5" /> Collection
          </div>
          <h1 className="font-serif text-2xl">{data?.name ?? "Loading…"}</h1>
          {data?.blurb && <p className="mt-1 text-sm text-muted-foreground">{data.blurb}</p>}
        </div>
      </header>

      {items === null ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-card" />)}</div>
      ) : items.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">Nothing in this collection yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((h) => {
            const Icon = KIND_ICON[h.kind];
            return (
              <li key={`${h.kind}-${h.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-forest/10">
                  {h.cover ? <img src={h.cover} alt="" className="h-full w-full object-cover" /> : (
                    <div className="flex h-full w-full items-center justify-center text-forest/40"><Icon className="h-5 w-5" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 font-serif text-sm">{h.title}</p>
                  <p className="truncate text-[11px] capitalize text-muted-foreground">{h.kind}{h.subtitle ? ` · ${h.subtitle}` : ""}</p>
                </div>
                {h.link && (
                  <a href={h.link} target="_blank" rel="noopener noreferrer" className="rounded-full p-2 text-muted-foreground hover:text-foreground" aria-label="Open">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
