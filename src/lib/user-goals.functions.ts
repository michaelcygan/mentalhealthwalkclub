import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GoalKind = "walks_per_week" | "minutes_per_week";

export interface UserGoal {
  kind: GoalKind;
  target: number;
  updated_at: string;
}

export const getUserGoal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserGoal | null> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_goals" as never)
      .select("kind,target,updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as unknown as UserGoal | null) ?? null;
  });

const SetInput = z.object({
  kind: z.enum(["walks_per_week", "minutes_per_week"]),
  target: z.number().int().min(1).max(1000),
});

export const setUserGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SetInput.parse(d))
  .handler(async ({ data, context }): Promise<UserGoal> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("user_goals" as never)
      .upsert(
        { user_id: userId, kind: data.kind, target: data.target } as never,
        { onConflict: "user_id" },
      )
      .select("kind,target,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as UserGoal;
  });
