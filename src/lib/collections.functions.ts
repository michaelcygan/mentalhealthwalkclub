import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Not authorized");
}

const KindEnum = z.enum(["podcast", "ambient", "guided", "blog"]);

export interface CollectionCard {
  id: string;
  slug: string;
  name: string;
  blurb: string | null;
  cover_url: string | null;
  is_published: boolean;
  item_count: number;
}

export const listCollections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ include_drafts: z.boolean().default(false) }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<CollectionCard[]> => {
    const { supabase } = context;
    let q = supabase
      .from("listen_collections")
      .select("id,slug,name,blurb,cover_url,is_published,sort_order")
      .order("sort_order", { ascending: true });
    if (!data.include_drafts) q = q.eq("is_published", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r) => r.id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: items } = await supabase
        .from("listen_collection_items")
        .select("collection_id")
        .in("collection_id", ids);
      for (const it of items ?? []) counts[it.collection_id] = (counts[it.collection_id] ?? 0) + 1;
    }
    return (rows ?? []).map((r) => ({ ...r, item_count: counts[r.id] ?? 0 }));
  });

export const getCollectionBySlug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: c, error } = await supabase
      .from("listen_collections")
      .select("id,slug,name,blurb,cover_url,is_published")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) return { collection: null, items: [] };
    const { data: items } = await supabase
      .from("listen_collection_items")
      .select("id,kind,item_id,position")
      .eq("collection_id", c.id)
      .order("position", { ascending: true });
    return { collection: c, items: items ?? [] };
  });

export const adminUpsertCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, hyphens"),
      name: z.string().min(1).max(80),
      blurb: z.string().max(280).optional(),
      cover_url: z.string().url().optional(),
      is_published: z.boolean().default(false),
      sort_order: z.number().int().min(0).max(999).default(100),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { error } = await supabaseAdmin.from("listen_collections").update({
        slug: data.slug, name: data.name, blurb: data.blurb ?? null,
        cover_url: data.cover_url ?? null, is_published: data.is_published, sort_order: data.sort_order,
      }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("listen_collections").insert({
      slug: data.slug, name: data.name, blurb: data.blurb ?? null,
      cover_url: data.cover_url ?? null, is_published: data.is_published, sort_order: data.sort_order,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const adminDeleteCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("listen_collections").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminAddCollectionItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      collection_id: z.string().uuid(),
      kind: KindEnum,
      item_id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: maxRow } = await supabaseAdmin
      .from("listen_collection_items")
      .select("position")
      .eq("collection_id", data.collection_id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPos = (maxRow?.position ?? -1) + 1;
    const { error } = await supabaseAdmin.from("listen_collection_items").insert({
      collection_id: data.collection_id, kind: data.kind, item_id: data.item_id, position: nextPos,
    });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const adminRemoveCollectionItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("listen_collection_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
