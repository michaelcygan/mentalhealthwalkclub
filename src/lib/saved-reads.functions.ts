import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireUnderCap } from "@/lib/plus-guard.server";

export interface SavedReadCard {
  id: string;
  title: string;
  link: string;
  image_url: string | null;
  publisher: string | null;
  saved_at: string;
}

export const listSavedReads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SavedReadCard[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("saved_reads")
      .select(
        "saved_at,post_id,blog_posts!inner(id,title,link,image_url,blog_feeds(publisher))",
      )
      .eq("user_id", userId)
      .order("saved_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => {
      const p = (r as unknown as {
        blog_posts: {
          id: string;
          title: string;
          link: string;
          image_url: string | null;
          blog_feeds: { publisher: string | null } | null;
        };
      }).blog_posts;
      return {
        id: p.id,
        title: p.title,
        link: p.link,
        image_url: p.image_url,
        publisher: p.blog_feeds?.publisher ?? null,
        saved_at: (r as { saved_at: string }).saved_at,
      };
    });
  });

export const toggleSavedRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ post_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("saved_reads")
      .select("post_id")
      .eq("user_id", userId)
      .eq("post_id", data.post_id)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("saved_reads")
        .delete()
        .eq("user_id", userId)
        .eq("post_id", data.post_id);
      if (error) throw new Error(error.message);
      return { saved: false };
    }
    // Soft-cap gate before insert (Plus users bypass).
    const { count } = await supabase
      .from("saved_reads")
      .select("post_id", { count: "exact", head: true })
      .eq("user_id", userId);
    await requireUnderCap(supabase, userId, {
      surface: "saved_reads",
      currentCount: count ?? 0,
    });
    const { error } = await supabase
      .from("saved_reads")
      .insert({ user_id: userId, post_id: data.post_id });
    if (error) throw new Error(error.message);
    return { saved: true };
  });

export const listSavedPostIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("saved_reads")
      .select("post_id")
      .eq("user_id", userId);
    return (data ?? []).map((r) => r.post_id as string);
  });
