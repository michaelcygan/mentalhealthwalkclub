import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronRight } from "lucide-react";
import { listPublished, type BlogPostListItem } from "@/lib/blog-cms.functions";
import { Card } from "@/components/ui/card";

const SITE_URL = "https://mentalhealthwalkclub.com/blog";
const DESC = "Essays and field notes on walking, mental health, and community from Mental Health Walk Club.";
const OG_DEFAULT = "https://mentalhealthwalkclub.com/__l5e/assets-v1/7244738f-35c7-4630-a18d-c08ba328bd68/og-default-v2.jpg";

export const Route = createFileRoute("/blog")({
  component: BlogIndex,
  loader: () => listPublished({ data: { limit: 20 } }),
  head: () => ({
    meta: [
      { title: "Blog — Mental Health Walk Club" },
      { name: "description", content: DESC },
      { property: "og:title", content: "Mental Health Walk Club — Blog" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: OG_DEFAULT },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Mental Health Walk Club — Blog" },
      { name: "twitter:description", content: DESC },
      { name: "twitter:image", content: OG_DEFAULT },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
  }),
});

function BlogIndex() {
  const initial = Route.useLoaderData() as BlogPostListItem[];
  const fetcher = useServerFn(listPublished);
  const { data } = useQuery({
    queryKey: ["blog", "index"],
    queryFn: () => fetcher({ data: { limit: 20 } }),
    initialData: initial,
    staleTime: 60_000,
  });
  const posts = (data ?? []) as BlogPostListItem[];

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <header>
        <h1 className="flex items-center gap-2 font-serif text-3xl text-foreground">
          <BookOpen className="h-6 w-6 text-forest" /> Blog
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{DESC}</p>
      </header>

      {posts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/40 p-8 text-center">
          <p className="font-serif text-lg text-foreground">Nothing here yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Field notes and essays are on the way. In the meantime — get out for a walk.
          </p>
          <Link
            to="/groups"
            className="mt-5 inline-flex items-center gap-1 rounded-full bg-forest px-4 py-2 text-sm text-primary-foreground transition hover:opacity-90"
          >
            Find a walking group <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p.id}>
              <Link
                to="/blog/$slug"
                params={{ slug: p.slug }}
                className="block"
              >
                <Card className="flex overflow-hidden rounded-2xl border-border bg-card/90 transition hover:-translate-y-0.5 hover:shadow-soft">
                  {p.cover_signed && (
                    <div className="h-28 w-28 shrink-0 bg-muted">
                      <img src={p.cover_signed} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col justify-center p-4">
                    <h2 className="line-clamp-2 font-serif text-lg text-foreground">{p.title}</h2>
                    {p.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.summary}</p>}
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                      {p.published_at ? new Date(p.published_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Draft"}
                      <ChevronRight className="h-3 w-3" />
                    </p>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
