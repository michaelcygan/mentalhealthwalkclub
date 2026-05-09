import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useAuth } from "@/lib/auth-context";

export interface SubscriptionRow {
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  price_id: string | null;
  trial_end?: string | null;
}

export interface SubscriptionState {
  loading: boolean;
  isPlus: boolean;
  isTrialing: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  raw: SubscriptionRow | null;
  refresh: () => Promise<void>;
}

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function useSubscription(): SubscriptionState {
  const { user } = useAuth();
  const [row, setRow] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) {
      setRow(null);
      setLoading(false);
      return;
    }
    const env = getStripeEnvironment();
    const { data } = await supabase
      .from("subscriptions" as never)
      .select("status,current_period_end,cancel_at_period_end,price_id")
      .eq("user_id", user.id)
      .eq("environment", env)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setRow((data as unknown as SubscriptionRow) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    refresh();
    if (!user) return;
    const channel = supabase
      .channel(`subscriptions:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const periodEnd = row?.current_period_end ? new Date(row.current_period_end) : null;
  const stillInPeriod = !periodEnd || periodEnd.getTime() > Date.now();
  const isActive =
    !!row && ACTIVE_STATUSES.has(row.status) && stillInPeriod;
  const isCanceledButActive =
    !!row && row.status === "canceled" && !!periodEnd && periodEnd.getTime() > Date.now();

  return {
    loading,
    isPlus: isActive || isCanceledButActive,
    isTrialing: row?.status === "trialing",
    cancelAtPeriodEnd: !!row?.cancel_at_period_end,
    currentPeriodEnd: periodEnd,
    raw: row,
    refresh,
  };
}
