import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useAuth } from "@/lib/auth-context";

export interface MembershipState {
  loading: boolean;
  isPlus: boolean;
  isPatron: boolean;
  patronCents: number;
  plusInterval: "monthly" | "yearly" | null;
  cancelAtPeriodEnd: boolean;
  plusStatus: string | null;
  plusCurrentPeriodEnd: Date | null;
  patronStatus: string | null;
  refresh: () => Promise<void>;
}

interface SubRow {
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  price_id: string | null;
  monthly_amount_cents: number | null;
  subscription_kind: string | null;
}

const ACTIVE = new Set(["active", "trialing", "past_due"]);

export function useMembership(): MembershipState {
  const { user } = useAuth();
  const [plusRow, setPlusRow] = useState<SubRow | null>(null);
  const [patronRow, setPatronRow] = useState<SubRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setPlusRow(null);
      setPatronRow(null);
      setLoading(false);
      return;
    }
    const env = getStripeEnvironment();
    const baseSelect = "status,current_period_end,cancel_at_period_end,price_id,monthly_amount_cents,subscription_kind";
    const [{ data: p }, { data: pat }] = await Promise.all([
      supabase
        .from("subscriptions" as never)
        .select(baseSelect)
        .eq("user_id", user.id)
        .eq("environment", env)
        .eq("subscription_kind", "plus")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("subscriptions" as never)
        .select(baseSelect)
        .eq("user_id", user.id)
        .eq("environment", env)
        .eq("subscription_kind", "patron")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setPlusRow((p as unknown as SubRow) ?? null);
    setPatronRow((pat as unknown as SubRow) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    refresh();
    if (!user) return;
    const nonce =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    const channel = supabase
      .channel(`membership:${user.id}:${nonce}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  const plusPeriodEnd = plusRow?.current_period_end ? new Date(plusRow.current_period_end) : null;
  const plusInPeriod = !plusPeriodEnd || plusPeriodEnd.getTime() > Date.now();
  const isPlusActive =
    (!!plusRow && ACTIVE.has(plusRow.status) && plusInPeriod) ||
    (!!plusRow && plusRow.status === "canceled" && !!plusPeriodEnd && plusPeriodEnd.getTime() > Date.now());

  const patronPeriodEnd = patronRow?.current_period_end ? new Date(patronRow.current_period_end) : null;
  const patronInPeriod = !patronPeriodEnd || patronPeriodEnd.getTime() > Date.now();
  const isPatronActive =
    (!!patronRow && ACTIVE.has(patronRow.status) && patronInPeriod) ||
    (!!patronRow && patronRow.status === "canceled" && !!patronPeriodEnd && patronPeriodEnd.getTime() > Date.now());

  const plusInterval: "monthly" | "yearly" | null =
    plusRow?.price_id === "plus_yearly" ? "yearly" : plusRow?.price_id === "plus_monthly" ? "monthly" : null;

  return {
    loading,
    isPlus: isPlusActive,
    isPatron: isPatronActive,
    patronCents: isPatronActive ? (patronRow?.monthly_amount_cents ?? 0) : 0,
    plusInterval,
    cancelAtPeriodEnd: !!plusRow?.cancel_at_period_end,
    plusStatus: plusRow?.status ?? null,
    plusCurrentPeriodEnd: plusPeriodEnd,
    patronStatus: patronRow?.status ?? null,
    refresh,
  };
}
