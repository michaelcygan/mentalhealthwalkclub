import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Eligibility, EligibilityStatus, SafetyRealm } from "@/lib/safety-config";

const DobInput = z.object({
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
});

/** Return the current signed-in account's eligibility + age band. Never returns DOB. */
export const getMyEligibility = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Eligibility> => {
    const { supabase, userId } = context;
    const [{ data: safety }, { data: profile }] = await Promise.all([
      supabase
        .from("account_safety")
        .select("eligibility_status,safety_realm")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.from("profiles").select("age_band").eq("id", userId).maybeSingle(),
    ]);
    return {
      eligibilityStatus: (safety?.eligibility_status ?? "pending_age") as EligibilityStatus,
      safetyRealm: (safety?.safety_realm ?? "unknown") as SafetyRealm,
      ageBand: profile?.age_band ?? null,
    };
  });

/** Confirm the caller's date of birth. One-shot from the user's side. */
export const confirmMyDateOfBirth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => DobInput.parse(d))
  .handler(async ({ data, context }): Promise<Eligibility> => {
    const { supabase } = context;
    const { data: result, error } = await supabase.rpc("confirm_my_date_of_birth", {
      _dob: data.dob,
    });
    if (error) throw new Error(error.message);
    const r = result as { eligibilityStatus?: string; safetyRealm?: string; ageBand?: string | null } | null;
    return {
      eligibilityStatus: (r?.eligibilityStatus ?? "pending_age") as EligibilityStatus,
      safetyRealm: (r?.safetyRealm ?? "unknown") as SafetyRealm,
      ageBand: r?.ageBand ?? null,
    };
  });

/** Server-side helper used by other server fns: throws if caller is not adult-active. */
export async function requireAdultAccount(
  supabase: { rpc: (fn: "is_adult_active", args: { _user_id: string }) => Promise<{ data: unknown; error: unknown }> } | unknown,
  userId: string,
): Promise<void> {
  // Cast to any-like RPC caller — Supabase generated types constrain fn name to a union
  // that already includes is_adult_active.
  const client = supabase as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
  const { data } = await client.rpc("is_adult_active", { _user_id: userId });
  if (data !== true) {
    const err = new Error("adult_account_required");
    (err as Error & { code?: string }).code = "adult_account_required";
    throw err;
  }
}
