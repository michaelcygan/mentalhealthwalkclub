import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

export interface BlogPostListItem {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  cover_signed: string | null;
  published_at: string | null;
}

export interface BlogPostFull {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body_html: string;
  cover_signed: string | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  updated_at: string;
}

const COVER_TTL = 60 * 60 * 24;

function serverClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function renderMarkdown(md: string): string {
  const raw = marked.parse(md, { async: false }) as string;
  return sanitizeHtml(raw, {
    allowedTags: [
      "h1","h2","h3","h4","h5","h6","p","ul","ol","li","blockquote","hr",
      "pre","code","em","strong","del","a","img","br","span","figure","figcaption","table","thead","tbody","tr","th","td",
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title"],
      span: ["class"],
      code: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (tag, attribs) => ({
        tagName: "a",
        attribs: { ...attribs, rel: "nofollow noopener noreferrer", target: "_blank" },
      }),
    },
  });
}

async function signCover(supabase: ReturnType<typeof serverClient>, path: string | null): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path; // legacy absolute URL
  const { data } = await supabase.storage.from("blog-covers").createSignedUrl(path, COVER_TTL);
  return data?.signedUrl ?? null;
}

export const listPublished = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z.object({ limit: z.number().int().min(1).max(50).optional(), offset: z.number().int().min(0).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const limit = data.limit ?? 20;
    const offset = data.offset ?? 0;
    const { data: rows, error } = await supabase
      .from("blog_posts")
      .select("id,slug,title,summary,cover_url,published_at")
      .eq("status", "published")
      .not("slug", "is", null)
      .order("published_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);
    const items: BlogPostListItem[] = await Promise.all(
      (rows ?? []).map(async (r) => ({
        id: r.id,
        slug: r.slug as string,
        title: r.title,
        summary: r.summary,
        published_at: r.published_at,
        cover_signed: await signCover(supabase, r.cover_url ?? null),
      })),
    );
    return items;
  });

export const getBySlug = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: row, error } = await supabase
      .from("blog_posts")
      .select("id,slug,title,summary,body_html,cover_url,seo_title,seo_description,published_at,updated_at,status")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || !row.body_html) return null;
    const full: BlogPostFull = {
      id: row.id,
      slug: row.slug as string,
      title: row.title,
      summary: row.summary,
      body_html: row.body_html,
      cover_signed: await signCover(supabase, row.cover_url ?? null),
      seo_title: row.seo_title,
      seo_description: row.seo_description,
      published_at: row.published_at,
      updated_at: row.updated_at,
    };
    return full;
  });

// --- Admin --------------------------------------------------------------

async function assertAdmin(context: { supabase: ReturnType<typeof serverClient>; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

export const adminList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("blog_posts")
      .select("id,slug,title,status,published_at,updated_at,cover_url")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminGet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase.from("blog_posts").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    let coverSigned: string | null = null;
    if (row?.cover_url && !/^https?:\/\//.test(row.cover_url)) {
      const { data: s } = await context.supabase.storage.from("blog-covers").createSignedUrl(row.cover_url, COVER_TTL);
      coverSigned = s?.signedUrl ?? null;
    } else if (row?.cover_url) {
      coverSigned = row.cover_url;
    }
    return { post: row, coverSigned };
  });

export const adminUpsert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().min(1).max(200),
        slug: z.string().max(80).optional(),
        summary: z.string().max(400).nullable().optional(),
        body_md: z.string().min(1),
        cover_url: z.string().nullable().optional(),
        seo_title: z.string().max(120).nullable().optional(),
        seo_description: z.string().max(300).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const slug = (data.slug && data.slug.length ? slugify(data.slug) : slugify(data.title)) || `post-${Date.now()}`;
    const body_html = renderMarkdown(data.body_md);
    const base = {
      title: data.title,
      slug,
      summary: data.summary ?? null,
      body_md: data.body_md,
      body_html,
      cover_url: data.cover_url ?? null,
      seo_title: data.seo_title ?? null,
      seo_description: data.seo_description ?? null,
      author_id: context.userId,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase.from("blog_posts").update(base).eq("id", data.id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase.from("blog_posts").insert({ ...base, status: "draft" }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminPublish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), publish: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const patch = data.publish
      ? { status: "published" as const, published_at: new Date().toISOString() }
      : { status: "draft" as const };
    const { data: row, error } = await context.supabase.from("blog_posts").update(patch).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("blog_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
