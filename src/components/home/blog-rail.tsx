import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useServerFn } from "@tanstack/react-start";
import { recentBlogPosts, type BlogPostCard } from "@/lib/blogs.functions";
import { BookOpen } from "lucide-react";

export function BlogRail() {
  const fetcher = useServerFn(recentBlogPosts);
  const [items, setItems] = useState<BlogPostCard[] | null>(null);

  useEffect(() => {
    fetcher({ data: { limit: 8 } }).then(setItems).catch(() => setItems([]));
  }, [fetcher]);

  if (items === null) return <div className="h-44 animate-pulse rounded-2xl bg-muted/40" />;
  if (!items.length) return null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 font-serif text-lg text-foreground">
          <BookOpen className="h-4 w-4 text-forest" /> Read
        </h2>
        <span className="text-xs text-muted-foreground">Fresh from trusted sources</span>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((p) => (
          <Link
            key={p.id}
            to="/read/$postId"
            params={{ postId: p.id }}
            className="block w-60 shrink-0"
          >
            <Card className="flex h-full flex-col overflow-hidden rounded-2xl border-border bg-card/90 shadow-soft backdrop-blur-sm transition hover:-translate-y-0.5">
              {p.image_url ? (
                <div className="aspect-[16/9] w-full bg-muted">
                  <img src={p.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                </div>
              ) : null}
              <div className="flex flex-1 flex-col p-3">
                {p.publisher && (
                  <span className="mb-1 inline-block w-fit rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground">{p.publisher}</span>
                )}
                <p className="line-clamp-3 text-sm font-medium leading-snug text-foreground">{p.title}</p>
                {p.summary && <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{p.summary}</p>}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
