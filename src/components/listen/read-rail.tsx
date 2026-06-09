import { useEffect, useState } from "react";
import { BookmarkPlus, BookmarkCheck, ExternalLink, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { recentBlogPosts, type BlogPostCard } from "@/lib/blogs.functions";
import { listSavedPostIds, toggleSavedRead } from "@/lib/saved-reads.functions";
import { parseCapError, CAP_UPSELL_COPY, type CapError } from "@/lib/cap-error";
import { UpsellSheet } from "@/components/membership/upsell-sheet";

function estReadMin(summary: string | null) {
  if (!summary) return null;
  const words = summary.split(/\s+/).filter(Boolean).length;
  const m = Math.max(2, Math.round(words / 200));
  return `${m} min read`;
}

export function ReadRail() {
  const [posts, setPosts] = useState<BlogPostCard[] | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [capError, setCapError] = useState<CapError | null>(null);
  const fetchPosts = useServerFn(recentBlogPosts);
  const fetchSaved = useServerFn(listSavedPostIds);
  const toggle = useServerFn(toggleSavedRead);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchPosts({ data: { limit: 12 } }), fetchSaved().catch(() => [])]).then(([p, s]) => {
      if (!alive) return;
      setPosts(p);
      setSaved(new Set(s));
    });
    return () => {
      alive = false;
    };
  }, [fetchPosts, fetchSaved]);

  async function onToggle(id: string) {
    const next = new Set(saved);
    const wasSaved = next.has(id);
    if (wasSaved) next.delete(id);
    else next.add(id);
    setSaved(next);
    try {
      const r = await toggle({ data: { post_id: id } });
      toast.success(r.saved ? "Saved for later" : "Removed");
    } catch (e) {
      // revert
      const revert = new Set(saved);
      setSaved(revert);
      const cap = parseCapError(e);
      if (cap) setCapError(cap);
      else toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  if (posts === null) {
    return (
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-52 w-44 shrink-0 animate-pulse rounded-2xl bg-card" />
        ))}
      </div>
    );
  }
  if (posts.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-border bg-card/60 p-5 text-center text-xs text-muted-foreground">
        Nothing new from the feeds yet. Check back after the next sync.
      </p>
    );
  }
  return (
    <>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
        {posts.map((p) => {
          const isSaved = saved.has(p.id);
          return (
            <article
              key={p.id}
              className="flex w-48 shrink-0 snap-start flex-col rounded-2xl border border-border bg-card p-2 shadow-soft"
            >
              <div className="relative mb-2 aspect-square overflow-hidden rounded-xl bg-forest/10">
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-forest/40">
                    <BookOpen className="h-8 w-8" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onToggle(p.id)}
                  aria-label={isSaved ? "Remove from saved" : "Save for later"}
                  className="absolute right-1.5 top-1.5 rounded-full bg-background/85 p-1.5 text-foreground shadow-sm hover:bg-background"
                >
                  {isSaved ? <BookmarkCheck className="h-3.5 w-3.5 text-forest" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="line-clamp-2 font-serif text-sm leading-tight">{p.title}</p>
              <p className="mt-1 truncate text-[10px] text-muted-foreground">
                {p.publisher ?? "—"}
                {estReadMin(p.summary) ? ` · ${estReadMin(p.summary)}` : ""}
              </p>
              <a
                href={p.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[11px] text-forest hover:underline"
              >
                Read <ExternalLink className="h-3 w-3" />
              </a>
            </article>
          );
        })}
      </div>
      {capError && (
        <UpsellSheet
          open={!!capError}
          onOpenChange={(o) => !o && setCapError(null)}
          surface={capError.surface}
          title={CAP_UPSELL_COPY[capError.surface].title}
          body={CAP_UPSELL_COPY[capError.surface].body(capError.cap)}
          cap={capError.cap}
        />
      )}
    </>
  );
}
