import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, BookOpen } from "lucide-react";
import { getReadableArticle, type ReaderArticle } from "@/lib/blogs.functions";
import { Button } from "@/components/ui/button";
import { Shimmer } from "@/components/ui/shimmer";

export const Route = createFileRoute("/_authenticated/read/$postId")({
  component: ReadArticlePage,
  head: () => ({
    meta: [
      { title: "Reader — Mental Health Walk Club" },
      { name: "description", content: "Read articles inside the app." },
    ],
  }),
});

function ReadArticlePage() {
  const { postId } = Route.useParams();
  const router = useRouter();
  const fetcher = useServerFn(getReadableArticle);
  const [article, setArticle] = useState<ReaderArticle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setArticle(null);
    setError(null);
    fetcher({ data: { post_id: postId } })
      .then((a) => alive && setArticle(a))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load"));
    return () => {
      alive = false;
    };
  }, [postId, fetcher]);

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => router.history.back()}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <span className="truncate text-xs text-muted-foreground">
          {article?.publisher ?? "Reader"}
        </span>
        {article ? (
          <a
            href={article.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-forest hover:underline"
          >
            Original <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="w-12" />
        )}
      </header>

      <main className="mx-auto w-full max-w-2xl px-5 pt-6">
        {error && (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center">
            <p className="text-sm text-muted-foreground">We couldn't load this article.</p>
            <Link
              to="/listen"
              className="mt-2 inline-block text-sm text-forest hover:underline"
            >
              Back to Listen & Read
            </Link>
          </div>
        )}

        {!article && !error && (
          <div className="space-y-3">
            <Shimmer className="h-8 w-3/4" />
            <Shimmer className="h-4 w-1/3" />
            <Shimmer className="aspect-[16/9] w-full" />
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-4 w-11/12" />
            <Shimmer className="h-4 w-10/12" />
          </div>
        )}

        {article && (
          <article>
            {article.publisher && (
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-forest">
                {article.publisher}
              </p>
            )}
            <h1 className="font-serif text-2xl leading-tight text-foreground sm:text-3xl">
              {article.title}
            </h1>
            {(article.byline || article.published_at) && (
              <p className="mt-2 text-xs text-muted-foreground">
                {[article.byline, article.published_at ? new Date(article.published_at).toLocaleDateString() : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {article.hero_image && (
              <div className="mt-4 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-muted">
                <img
                  src={article.hero_image}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            {article.content_html ? (
              <div
                className="prose prose-sm mt-6 max-w-none text-foreground prose-headings:font-serif prose-headings:text-foreground prose-p:text-foreground/90 prose-a:text-forest prose-img:rounded-xl"
                dangerouslySetInnerHTML={{ __html: article.content_html }}
              />
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center">
                <BookOpen className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {article.excerpt ?? "Reader view isn't available for this article."}
                </p>
                <Button asChild className="mt-4">
                  <a href={article.source_url} target="_blank" rel="noopener noreferrer">
                    Open original <ExternalLink className="ml-1 h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            )}

            <div className="mt-10 border-t border-border pt-4 text-center text-xs text-muted-foreground">
              From {article.publisher ?? "the publisher"} ·{" "}
              <a
                href={article.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-forest hover:underline"
              >
                View original
              </a>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
