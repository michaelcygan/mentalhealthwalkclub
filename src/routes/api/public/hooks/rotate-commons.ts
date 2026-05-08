import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// When the active Commons cohort fills, flip auto_join off and create a new cohort.
export const Route = createFileRoute("/api/public/hooks/rotate-commons")({
  server: {
    handlers: {
      POST: async () => {
        const { data: configRows } = await supabaseAdmin
          .from("ghost_walk_config")
          .select("value")
          .eq("key", "commons_cohort_cap")
          .single();
        const cap = (configRows?.value as number) ?? 1000;

        // Find active commons cohort(s)
        const { data: active } = await supabaseAdmin
          .from("groups")
          .select("id,slug,member_count")
          .eq("auto_join", true)
          .like("slug", "the-commons%");

        let rotated = 0;
        for (const cohort of active ?? []) {
          // Count real (non-host) members
          const { count: realMembers } = await supabaseAdmin
            .from("group_memberships")
            .select("id, profiles!inner(is_host_account)", { head: true, count: "exact" })
            .eq("group_id", cohort.id)
            .eq("status", "active")
            .eq("profiles.is_host_account", false);

          if ((realMembers ?? 0) < cap) continue;

          // Derive next cohort number
          const match = cohort.slug.match(/the-commons-(\d+)$/);
          const next = match ? parseInt(match[1], 10) + 1 : 2;
          const newSlug = `the-commons-${String(next).padStart(2, "0")}`;

          await supabaseAdmin
            .from("groups")
            .update({ auto_join: false })
            .eq("id", cohort.id);

          await supabaseAdmin.from("groups").insert({
            slug: newSlug,
            name: `The Commons ${String(next).padStart(2, "0")}`,
            description: `Cohort ${next}. Where everyone in this wave starts.`,
            theme: "connection",
            group_type: "community",
            is_active: true,
            auto_join: true,
            image_url: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800",
          });
          rotated++;
        }

        return Response.json({ ok: true, scanned: active?.length ?? 0, rotated });
      },
    },
  },
});
