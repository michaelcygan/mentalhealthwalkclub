import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdultAccount } from "@/lib/account-eligibility.functions";
import { SOLO_WALK_MAX_SECONDS, SOLO_WALK_REFLECTION_PROMPT } from "@/lib/solo-walk.constants";

export interface SoloWalkSession {
  id: string;
  status: "active" | "completed" | "abandoned";
  walk_type: "solo";
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  mood_before: string | null;
  mood_after: string | null;
  intention: string | null;
  reflection_note: string | null;
  reflection_prompt: string | null;
}

const SELECT_COLS =
  "id,status,walk_type,started_at,ended_at,duration_seconds,mood_before,mood_after,intention,reflection_note,reflection_prompt";

type RawRow = {
  id: string;
  status: string;
  walk_type: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  mood_before: string | null;
  mood_after: string | null;
  intention: string | null;
  reflection_note: string | null;
  reflection_prompt: string | null;
};

function normalize(row: RawRow): SoloWalkSession {
  return {
    id: row.id,
    status: row.status as SoloWalkSession["status"],
    walk_type: "solo",
    started_at: row.started_at,
    ended_at: row.ended_at,
    duration_seconds: row.duration_seconds,
    mood_before: row.mood_before,
    mood_after: row.mood_after,
    intention: row.intention,
    reflection_note: row.reflection_note,
    reflection_prompt: row.reflection_prompt,
  };
}

// Mood values remain freeform text on the DB; we lightly bound length.
const MoodSchema = z.string().trim().min(1).max(64).nullish();
const IntentionSchema = z.string().trim().min(1).max(240).nullish();
const ReflectionSchema = z.string().trim().max(20000).nullish();
const PromptSchema = z.string().trim().max(1000).nullish();

export const getActiveSoloWalk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SoloWalkSession | null> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("walk_sessions")
      .select(SELECT_COLS)
      .eq("user_id", userId)
      .eq("walk_type", "solo")
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? normalize(data as unknown as RawRow) : null;
  });

const StartInput = z.object({
  moodBefore: MoodSchema.optional(),
  intention: IntentionSchema.optional(),
});

export const startSoloWalk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StartInput.parse(d ?? {}))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ session: SoloWalkSession; resumedExisting: boolean }> => {
      const { supabase, userId } = context;
      await requireAdultAccount(supabase, userId);

      // Return existing active if any.
      const existing = await supabase
        .from("walk_sessions")
        .select(SELECT_COLS)
        .eq("user_id", userId)
        .eq("walk_type", "solo")
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing.error) throw new Error(existing.error.message);
      if (existing.data) {
        return { session: normalize(existing.data as unknown as RawRow), resumedExisting: true };
      }

      const insert = await supabase
        .from("walk_sessions")
        .insert({
          user_id: userId,
          walk_type: "solo",
          status: "active",
          mood_before: data.moodBefore?.trim() || null,
          intention: data.intention?.trim() || null,
          event_id: null,
          privacy: "private",
        })
        .select(SELECT_COLS)
        .single();

      if (insert.error) {
        // Unique-index race: another request created the active session first.
        const again = await supabase
          .from("walk_sessions")
          .select(SELECT_COLS)
          .eq("user_id", userId)
          .eq("walk_type", "solo")
          .eq("status", "active")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (again.data) {
          return { session: normalize(again.data as unknown as RawRow), resumedExisting: true };
        }
        throw new Error(insert.error.message);
      }
      return { session: normalize(insert.data as unknown as RawRow), resumedExisting: false };
    },
  );

const CompleteInput = z.object({
  id: z.string().uuid(),
  moodAfter: MoodSchema.optional(),
  reflectionNote: ReflectionSchema.optional(),
  reflectionPrompt: PromptSchema.optional(),
});

export const completeSoloWalk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CompleteInput.parse(d))
  .handler(async ({ data, context }): Promise<SoloWalkSession> => {
    const { supabase, userId } = context;

    const found = await supabase
      .from("walk_sessions")
      .select(SELECT_COLS + ",user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (found.error) throw new Error(found.error.message);
    if (!found.data) throw new Error("walk not found");
    const row = found.data as unknown as RawRow & { user_id: string };
    if (row.user_id !== userId) throw new Error("forbidden");
    if (row.walk_type !== "solo") throw new Error("not a solo walk");

    // Idempotent: if already completed, return it.
    if (row.status === "completed") return normalize(row);
    if (row.status !== "active") throw new Error("walk is not active");

    const startedMs = new Date(row.started_at).getTime();
    const nowMs = Date.now();
    const duration = Math.max(0, Math.round((nowMs - startedMs) / 1000));

    const update = await supabase
      .from("walk_sessions")
      .update({
        status: "completed",
        ended_at: new Date(nowMs).toISOString(),
        duration_seconds: duration,
        mood_after: data.moodAfter?.trim() || null,
        reflection_note: data.reflectionNote?.trim() || null,
        reflection_prompt: data.reflectionPrompt?.trim() || null,
      })
      .eq("id", data.id)
      .eq("user_id", userId)
      .eq("status", "active")
      .select(SELECT_COLS)
      .maybeSingle();
    if (update.error) throw new Error(update.error.message);
    if (!update.data) {
      // Someone else completed it in parallel: re-read.
      const reread = await supabase
        .from("walk_sessions")
        .select(SELECT_COLS)
        .eq("id", data.id)
        .single();
      if (reread.error) throw new Error(reread.error.message);
      return normalize(reread.data as unknown as RawRow);
    }
    return normalize(update.data as unknown as RawRow);
  });

const AbandonInput = z.object({ id: z.string().uuid() });

export const abandonSoloWalk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AbandonInput.parse(d))
  .handler(async ({ data, context }): Promise<SoloWalkSession> => {
    const { supabase, userId } = context;
    const found = await supabase
      .from("walk_sessions")
      .select(SELECT_COLS + ",user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (found.error) throw new Error(found.error.message);
    if (!found.data) throw new Error("walk not found");
    const row = found.data as unknown as RawRow & { user_id: string };
    if (row.user_id !== userId) throw new Error("forbidden");
    if (row.walk_type !== "solo") throw new Error("not a solo walk");
    if (row.status !== "active") return normalize(row);

    const update = await supabase
      .from("walk_sessions")
      .update({ status: "abandoned", ended_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId)
      .select(SELECT_COLS)
      .single();
    if (update.error) throw new Error(update.error.message);
    return normalize(update.data as unknown as RawRow);
  });
