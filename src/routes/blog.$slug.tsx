import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { getBySlug, type BlogPostFull } from "@/lib/blog-cms.functions";

export const Route = createFileRoute("/blog/$slug")({
  component: BlogPostPage,
  loader: async ({ params }) => {
    const post = await getBySlug({ data: { slug: params.slug } });
    if (!post) throw notFound();
    return post;
  },
  head: ({ loaderData }) => {
    const post = loaderData as BlogPostFull | undefined;
    if (!post) {
      return { meta: [{ title: "Post not found — Mental Health Walk Club" }] };
    }
    const title = post.seo_title ?? `${post.title} — Mental Health Walk Club`;
    const desc = post.seo_description ?? post.summary ?? "A note from Mental Health Walk Club.";
    const url = `https://mentalhealthwalkclub.com/blog/${post.slug}`;
    const meta: Array<{ title?: string; name?: string; property?: string; content?: string }> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: desc },
    ];
    const image = post.cover_signed ?? "https://mentalhealthwalkclub.com/__l5e/assets-v1/7a90bd38-5bbe-4fc5-8eb1-3d80cb7cad77/og-default.jpg";
    meta.push({ property: "og:image", content: image });
    meta.push({ name: "twitter:image", content: image });
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description: desc,
            image: post.cover_signed ?? undefined,
            datePublished: post.published_at,
            dateModified: post.updated_at,
            mainEntityOfPage: url,
            publisher: {
              "@type": "Organization",
              name: "Mental Health Walk Club",
            },
          }),
        },
      ],
    };
  },
});

function BlogPostPage() {
  const post = Route.useLoaderData() as BlogPostFull;
  return (
    <article className="mx-auto max-w-2xl py-6">
      <Link to="/blog" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Blog
      </Link>
      <header className="mt-4">
        <h1 className="font-serif text-4xl leading-tight text-foreground">{post.title}</h1>
        {post.summary && <p className="mt-3 text-base text-muted-foreground">{post.summary}</p>}
        <p className="mt-2 text-xs text-muted-foreground">
          {post.published_at && new Date(post.published_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </header>
      {post.cover_signed && (
        <img
          src={post.cover_signed}
          alt=""
          className="mt-6 w-full rounded-3xl object-cover shadow-soft"
          decoding="async"
        />
      )}
      <div
        className="prose prose-neutral mt-6 max-w-none prose-headings:font-serif prose-a:text-forest prose-img:rounded-2xl dark:prose-invert"
        // Server-sanitized HTML from marked + sanitize-html.
        dangerouslySetInnerHTML={{ __html: post.body_html }}
      />
    </article>
  );
}
