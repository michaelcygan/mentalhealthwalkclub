import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export interface RadioUsageState {
  loading: boolean;
  freeSeconds: number;
  usedSeconds: number;
  refresh: () => Promise<void>;
}

function currentMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export function useRadioUsage(): RadioUsageState {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [freeSeconds, setFreeSeconds] = useState(0);
  const [usedSeconds, setUsedSeconds] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: settings } = await supabase
        .from("membership_settings")
        .select("radio_free_seconds")
        .eq("id", true)
        .maybeSingle();
      setFreeSeconds((settings as { radio_free_seconds?: number } | null)?.radio_free_seconds ?? 0);

      if (user) {
        const { data: usage } = await supabase
          .from("radio_monthly_usage")
          .select("seconds_used")
          .eq("user_id", user.id)
          .eq("month_start", currentMonthStart())
          .maybeSingle();
        setUsedSeconds((usage as { seconds_used?: number } | null)?.seconds_used ?? 0);
      } else {
        setUsedSeconds(0);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
    if (!user) return;
    const nonce =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    const channel = supabase
      .channel(`radio_usage:${user.id}:${nonce}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "radio_monthly_usage", filter: `user_id=eq.${user.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  return { loading, freeSeconds, usedSeconds, refresh };
}
