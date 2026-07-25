import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronLeft, Upload, Save, Eye, Trash2 } from "lucide-react";
import { marked } from "marked";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminGet, adminUpsert, adminPublish, adminDelete } from "@/lib/blog-cms.functions";
import { adminSignUpload } from "@/lib/radio.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/blog/$id")({
  component: AdminBlogEditor,
  head: () => ({ meta: [{ title: "Admin — Edit Post" }] }),
});

interface Post {
  id: string; title: string; slug: string | null; summary: string | null;
  body_md: string | null; cover_url: string | null;
  seo_title: string | null; seo_description: string | null;
  status: string; published_at: string | null;
}

function AdminBlogEditor() {
  const { id } = Route.useParams();
  const router = useRouter();
  const get = useServerFn(adminGet);
  const upsert = useServerFn(adminUpsert);
  const publish = useServerFn(adminPublish);
  const del = useServerFn(adminDelete);
  const signUp = useServerFn(adminSignUpload);

  const [post, setPost] = useState<Post | null>(null);
  const [coverSigned, setCoverSigned] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const load = async () => {
    const r = await get({ data: { id } });
    setPost(r.post as Post);
    setCoverSigned(r.coverSigned);
  };
  useEffect(() => { load().catch((e) => toast.error(String(e))); /* eslint-disable-next-line */ }, [id]);

  const save = async (): Promise<Post | null> => {
    if (!post) return null;
    setSaving(true);
    try {
      const row = await upsert({ data: {
        id: post.id, title: post.title, slug: post.slug || undefined,
        summary: post.summary, body_md: post.body_md ?? "",
        cover_url: post.cover_url, seo_title: post.seo_title, seo_description: post.seo_description,
      } }) as Post;
      setPost(row);
      toast.success("Saved");
      return row;
    } catch (e) { toast.error(String(e)); return null; } finally { setSaving(false); }
  };

  const togglePublish = async () => {
    if (!post) return;
    const saved = await save();
    if (!saved) return;
    try {
      const row = await publish({ data: { id: post.id, publish: post.status !== "published" } }) as Post;
      setPost(row);
      toast.success(row.status === "published" ? "Published" : "Unpublished");
    } catch (e) { toast.error(String(e)); }
  };

  const uploadCover = async (file: File) => {
    if (!post) return;
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${post.id}/cover-${Date.now()}.${ext}`;
      const { token } = await signUp({ data: { bucket: "blog-covers", path } });
      const { error } = await supabase.storage.from("blog-covers").uploadToSignedUrl(path, token, file);
      if (error) throw error;
      setPost({ ...post, cover_url: path });
      toast.success("Cover uploaded — remember to save");
    } catch (e) { toast.error(String(e)); }
  };

  const remove = async () => {
    if (!post) return;
    if (!confirm("Delete this post?")) return;
    try { await del({ data: { id: post.id } }); toast.success("Deleted"); router.navigate({ to: "/admin/blog" }); } catch (e) { toast.error(String(e)); }
  };

  if (!post) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const previewHtml = marked.parse(post.body_md ?? "", { async: false }) as string;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/admin/blog" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ChevronLeft className="h-3.5 w-3.5" /> All posts</Link>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowPreview((v) => !v)}><Eye className="mr-1 h-3.5 w-3.5" /> {showPreview ? "Edit" : "Preview"}</Button>
          <Button size="sm" variant="ghost" onClick={remove}><Trash2 className="mr-1 h-3.5 w-3.5" /></Button>
          <Button size="sm" onClick={save} disabled={saving}><Save className="mr-1 h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}</Button>
          <Button size="sm" onClick={togglePublish} variant={post.status === "published" ? "outline" : "default"}>
            {post.status === "published" ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>

      {showPreview ? (
        <article className="rounded-2xl border border-border bg-card p-6">
          {coverSigned && <img src={coverSigned} alt="" className="mb-4 w-full rounded-2xl object-cover" loading="lazy" decoding="async" />}
          <h1 className="font-serif text-3xl">{post.title}</h1>
          {post.summary && <p className="mt-2 text-muted-foreground">{post.summary}</p>}
          <div className="prose prose-neutral mt-4 max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </article>
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-4">
              <label className="grid h-24 w-24 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-border bg-muted">
                {coverSigned ? <img src={coverSigned} alt="" className="h-full w-full object-cover" decoding="async" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} />
              </label>
              <div className="flex-1 space-y-2">
                <Input value={post.title} onChange={(e) => setPost({ ...post, title: e.target.value })} placeholder="Title" />
                <Input value={post.slug ?? ""} onChange={(e) => setPost({ ...post, slug: e.target.value })} placeholder="slug (auto from title if empty)" />
                <Input value={post.summary ?? ""} onChange={(e) => setPost({ ...post, summary: e.target.value || null })} placeholder="Summary (shown in list)" />
              </div>
            </div>
          </div>

          <Textarea
            value={post.body_md ?? ""}
            onChange={(e) => setPost({ ...post, body_md: e.target.value })}
            placeholder="# Write your post in Markdown…"
            className="min-h-[420px] font-mono text-sm"
          />

          <details className="rounded-2xl border border-border bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium">SEO</summary>
            <div className="mt-3 space-y-2">
              <Input value={post.seo_title ?? ""} onChange={(e) => setPost({ ...post, seo_title: e.target.value || null })} placeholder="SEO title (defaults to post title)" />
              <Textarea value={post.seo_description ?? ""} onChange={(e) => setPost({ ...post, seo_description: e.target.value || null })} placeholder="SEO description" className="min-h-[80px]" />
            </div>
          </details>
        </>
      )}
    </div>
  );
}
