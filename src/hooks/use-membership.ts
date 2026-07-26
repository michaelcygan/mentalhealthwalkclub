import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useAuth } from "@/lib/auth-context";

const BASE_CENTS = 299;

export interface MembershipState {
  loading: boolean;
  isPlus: boolean;
  /** Voluntary donation on top of base (cents). */
  donationCents: number;
  /** Total monthly contribution (base + donation), cents. */
  monthlyCents: number;
  cancelAtPeriodEnd: boolean;
  plusStatus: string | null;
  plusCurrentPeriodEnd: Date | null;
  refresh: () => Promise<void>;
}

interface SubRow {
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  monthly_amount_cents: number | null;
  donation_allocation_cents: number | null;
  membership_allocation_cents: number | null;
}

const ACTIVE = new Set(["active", "trialing", "past_due"]);

export function useMembership(): MembershipState {
  const { user } = useAuth();
  const [row, setRow] = useState<SubRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setRow(null);
      setLoading(false);
      return;
    }
    const env = getStripeEnvironment();
    const { data } = await supabase
      .from("subscriptions" as never)
      .select(
        "status,current_period_end,cancel_at_period_end,monthly_amount_cents,donation_allocation_cents,membership_allocation_cents",
      )
      .eq("user_id", user.id)
      .eq("environment", env)
      .eq("subscription_kind", "plus")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setRow((data as unknown as SubRow) ?? null);
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

  const periodEnd = row?.current_period_end ? new Date(row.current_period_end) : null;
  const inPeriod = !periodEnd || periodEnd.getTime() > Date.now();
  const isActive =
    (!!row && ACTIVE.has(row.status) && inPeriod) ||
    (!!row && row.status === "canceled" && !!periodEnd && periodEnd.getTime() > Date.now());

  const donationCents = isActive ? (row?.donation_allocation_cents ?? 0) : 0;
  const baseCents = row?.membership_allocation_cents ?? BASE_CENTS;
  const monthlyCents = isActive ? (row?.monthly_amount_cents ?? baseCents + donationCents) : 0;

  return {
    loading,
    isPlus: isActive,
    donationCents,
    monthlyCents,
    cancelAtPeriodEnd: !!row?.cancel_at_period_end,
    plusStatus: row?.status ?? null,
    plusCurrentPeriodEnd: periodEnd,
    refresh,
  };
}
