import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, ChevronRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminList, adminUpsert } from "@/lib/blog-cms.functions";

export const Route = createFileRoute("/admin/blog")({
  component: AdminBlog,
  head: () => ({ meta: [{ title: "Admin — Blog" }] }),
});

interface Post {
  id: string; slug: string | null; title: string; status: string; published_at: string | null; updated_at: string; cover_url: string | null;
}

function AdminBlog() {
  const list = useServerFn(adminList);
  const upsert = useServerFn(adminUpsert);
  const [posts, setPosts] = useState<Post[] | null>(null);

  const load = async () => { try { setPosts((await list()) as Post[]); } catch (e) { toast.error(String(e)); } };
  useEffect(() => { load(); }, []);

  const createDraft = async () => {
    try {
      const row = await upsert({ data: { title: "Untitled draft", body_md: "# New post\n\nStart writing…" } });
      window.location.href = `/admin/blog/${(row as Post).id}`;
    } catch (e) { toast.error(String(e)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-serif text-xl"><FileText className="h-4 w-4 text-forest" /> Blog posts</h2>
        <Button size="sm" onClick={createDraft}><Plus className="mr-1 h-3.5 w-3.5" /> New post</Button>
      </div>
      {posts === null ? <p className="text-sm text-muted-foreground">Loading…</p> :
       posts.length === 0 ? <p className="text-sm text-muted-foreground">No posts yet.</p> : (
        <ul className="space-y-2">
          {posts.map((p) => (
            <li key={p.id}>
              <Link to="/admin/blog/$id" params={{ id: p.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:bg-accent">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{p.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    <span className={p.status === "published" ? "text-forest" : ""}>{p.status}</span>
                    {" · "}{new Date(p.updated_at).toLocaleDateString()}
                    {p.slug && ` · /${p.slug}`}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
