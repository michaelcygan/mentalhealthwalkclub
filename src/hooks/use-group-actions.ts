import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { toast } from "sonner";

export interface JoinableGroup { id: string; name: string }

export function useGroupActions() {
  const { user } = useAuth();
  const { requireAuth } = useAuthPrompt();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const toggleJoin = (g: JoinableGroup, isJoined: boolean, after?: () => void) =>
    requireAuth(async () => {
      if (!user) return;
      if (isJoined) {
        await supabase.from("group_memberships").delete().eq("group_id", g.id).eq("user_id", user.id);
        toast(`Left ${g.name}`);
      } else {
        await supabase.from("group_memberships").insert({ group_id: g.id, user_id: user.id });
        toast(`Joined ${g.name}`);
      }
      after?.();
    });

  const startSoloWalk = (g: JoinableGroup) =>
    requireAuth(async () => {
      if (!user) return;
      setBusy(true);
      try {
        const { data, error } = await supabase
          .from("walk_sessions")
          .insert({ user_id: user.id, walk_type: "solo", status: "active", group_id: g.id })
          .select("id")
          .single();
        if (error) throw error;
        navigate({ to: "/walk/active/$id" as never, params: { id: data.id } as never });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't start walk");
      } finally {
        setBusy(false);
      }
    });

  return { toggleJoin, startSoloWalk, busy };
}
