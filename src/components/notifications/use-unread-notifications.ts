import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getUnreadNotificationCount } from "@/lib/notifications.functions";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

/** Shared unread notification count with realtime + polling. Returns 0 when logged out. */
export function useUnreadNotifications(): number {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchCount = useServerFn(getUnreadNotificationCount);

  const { data } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => fetchCount({}),
    enabled: !!user,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!user?.id) return;
    const nonce =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Date.now().toString();
    const channel = supabase
      .channel(`notifications-unread:${user.id}:${nonce}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  return data?.count ?? 0;
}
