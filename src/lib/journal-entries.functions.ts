import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─── Reflection (journal_entries) CRUD ──────────────────────────────────────

const CreateInput = z.object({
  body: z.string().trim().min(1).max(20000),
  prompt_id: z.string().max(64).optional().nullable(),
  prompt_text: z.string().max(1000).optional().nullable(),
  source: z.enum(["home_reflection", "journal_freeform"]).default("home_reflection"),
});

export interface JournalEntry {
  id: string;
  body: string;
  prompt_id: string | null;
  prompt_text: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requirePlus(supabase: any, userId: string) {
  const { data } = await supabase
    .from("subscriptions")
    .select("current_period_end,status")
    .eq("user_id", userId)
    .eq("subscription_kind", "plus")
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const endsAt = data?.current_period_end ? new Date(data.current_period_end).getTime() : Number.POSITIVE_INFINITY;
  if (!data || endsAt < Date.now()) {
    throw new Error("plus_required");
  }
}

export const createJournalEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }): Promise<JournalEntry> => {
    const { supabase, userId } = context;
    await requirePlus(supabase as never, userId as string);
    const { data: row, error } = await supabase
      .from("journal_entries" as never)
      .insert({
        user_id: userId,
        body: data.body,
        prompt_id: data.prompt_id ?? null,
        prompt_text: data.prompt_text ?? null,
        source: data.source,
      } as never)
      .select("id,body,prompt_id,prompt_text,source,created_at,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as JournalEntry;
  });

const ListInput = z.object({ limit: z.number().int().min(1).max(50).default(20) });

export const listJournalEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<JournalEntry[]> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("journal_entries" as never)
      .select("id,body,prompt_id,prompt_text,source,created_at,updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as JournalEntry[];
  });

export const deleteJournalEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("journal_entries" as never)
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateJournalEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), body: z.string().trim().min(1).max(20000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("journal_entries" as never)
      .update({ body: data.body } as never)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Walk reflection update ─────────────────────────────────────────────────

export const updateWalkReflection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      reflection_note: z.string().trim().max(20000).nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const value = data.reflection_note && data.reflection_note.length > 0 ? data.reflection_note : null;
    const { error } = await supabase
      .from("walk_sessions")
      .update({ reflection_note: value })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Unified feed + stats ───────────────────────────────────────────────────

export type FeedEntryKind = "reflection" | "walk";

export interface FeedEntry {
  kind: FeedEntryKind;
  id: string;
  /** Timestamp used for ordering and the date header. */
  at: string;
  // reflection-only
  prompt_text?: string | null;
  body?: string | null;
  // walk-only
  duration_seconds?: number | null;
  steps?: number | null;
  mood_before?: string | null;
  mood_after?: string | null;
  mood_before_score?: number | null;
  mood_after_score?: number | null;
  reflection_note?: string | null;
  reflection_prompt?: string | null;
  walk_type?: string | null;
  intention?: string | null;
  weather_at_end?: { tempF?: number; label?: string; tone?: string; isDay?: boolean } | null;
  photo_urls?: string[];
  photo_count?: number;
}

interface WalkRow {
  id: string;
  started_at: string;
  duration_seconds: number | null;
  steps: number | null;
  mood_before: string | null;
  mood_after: string | null;
  mood_before_score: number | null;
  mood_after_score: number | null;
  reflection_note: string | null;
  reflection_prompt: string | null;
  walk_type: string;
  intention: string | null;
  weather_at_end: { tempF?: number; label?: string; tone?: string; isDay?: boolean } | null;
}

export const listJournalFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).default(100) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<FeedEntry[]> => {
    const { supabase, userId } = context;

    const [walksRes, entriesRes] = await Promise.all([
      supabase
        .from("walk_sessions")
        .select(
          "id,started_at,duration_seconds,steps,mood_before,mood_after,mood_before_score,mood_after_score,reflection_note,reflection_prompt,walk_type,intention,weather_at_end",
        )
        .eq("user_id", userId)
        .eq("status", "completed")
        .order("started_at", { ascending: false })
        .limit(data.limit),
      supabase
        .from("journal_entries" as never)
        .select("id,body,prompt_text,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(data.limit),
    ]);
    if (walksRes.error) throw new Error(walksRes.error.message);
    if (entriesRes.error) throw new Error(entriesRes.error.message);

    const walks = (walksRes.data ?? []) as unknown as WalkRow[];

    // Photos for these walks — counts + first 3 signed URLs each
    const walkIds = walks.map((w) => w.id);
    const photoCounts: Record<string, number> = {};
    const pathsByWalk: Record<string, string[]> = {};
    if (walkIds.length > 0) {
      const { data: photos } = await supabase
        .from("walk_photos")
        .select("walk_session_id,storage_path,taken_at_seconds")
        .in("walk_session_id", walkIds)
        .order("taken_at_seconds", { ascending: true });
      for (const p of (photos ?? []) as { walk_session_id: string; storage_path: string }[]) {
        photoCounts[p.walk_session_id] = (photoCounts[p.walk_session_id] ?? 0) + 1;
        if (!pathsByWalk[p.walk_session_id]) pathsByWalk[p.walk_session_id] = [];
        if (pathsByWalk[p.walk_session_id].length < 3) pathsByWalk[p.walk_session_id].push(p.storage_path);
      }
    }
    const allPaths = Object.values(pathsByWalk).flat();
    const signed = await Promise.all(
      allPaths.map(async (p) => {
        const { data: s } = await supabase.storage.from("walk-photos").createSignedUrl(p, 3600);
        return [p, s?.signedUrl ?? null] as const;
      }),
    );
    const urlByPath = new Map<string, string>();
    for (const [p, u] of signed) if (u) urlByPath.set(p, u);

    const walkEntries: FeedEntry[] = walks
      .filter((w) => {
        // Only show walks that have written/mood/photo content
        const hasNote = !!w.reflection_note?.trim();
        const hasMood = !!(w.mood_before || w.mood_after);
        const hasPhotos = (photoCounts[w.id] ?? 0) > 0;
        return hasNote || hasMood || hasPhotos;
      })
      .map((w) => ({
        kind: "walk" as const,
        id: w.id,
        at: w.started_at,
        duration_seconds: w.duration_seconds,
        steps: w.steps,
        mood_before: w.mood_before,
        mood_after: w.mood_after,
        mood_before_score: w.mood_before_score,
        mood_after_score: w.mood_after_score,
        reflection_note: w.reflection_note,
        reflection_prompt: w.reflection_prompt,
        walk_type: w.walk_type,
        intention: w.intention,
        weather_at_end: w.weather_at_end,
        photo_count: photoCounts[w.id] ?? 0,
        photo_urls: (pathsByWalk[w.id] ?? []).map((p) => urlByPath.get(p)).filter((u): u is string => !!u),
      }));

    const reflectionEntries: FeedEntry[] = (
      (entriesRes.data ?? []) as unknown as { id: string; body: string; prompt_text: string | null; created_at: string }[]
    ).map((r) => ({
      kind: "reflection" as const,
      id: r.id,
      at: r.created_at,
      prompt_text: r.prompt_text,
      body: r.body,
    }));

    return [...walkEntries, ...reflectionEntries].sort((a, b) => (a.at < b.at ? 1 : -1));
  });

export interface JournalBadge {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  earned_at: string;
}
export interface JournalStats {
  lifetime: { entries: number; walks: number; minutes: number; stepsLogged: number };
  /** ISO date strings (YYYY-MM-DD) — past 365 days */
  walkDays: string[];
  entryDays: string[];
  /** Minutes per ISO date — past 365 days */
  minutesByDay: Record<string, number>;
  /** After-walk mood scores past 30 days, oldest-first */
  moodArc30: { date: string; score: number }[];
  /** Most recently earned badges, newest first (cap 20) */
  badges: JournalBadge[];
  badgesCount: number;
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const getJournalStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<JournalStats> => {
    const { supabase, userId } = context;
    const yearAgo = new Date(); yearAgo.setHours(0, 0, 0, 0); yearAgo.setDate(yearAgo.getDate() - 365);
    const monthAgo = new Date(); monthAgo.setHours(0, 0, 0, 0); monthAgo.setDate(monthAgo.getDate() - 30);

    const [walksRes, entriesRes, badgeRes, walksTotalRes, entriesTotalRes] = await Promise.all([
      supabase
        .from("walk_sessions")
        .select("started_at,duration_seconds,steps,mood_after_score")
        .eq("user_id", userId)
        .eq("status", "completed")
        .gte("started_at", yearAgo.toISOString())
        .order("started_at", { ascending: true }),
      supabase
        .from("journal_entries" as never)
        .select("created_at")
        .eq("user_id", userId)
        .gte("created_at", yearAgo.toISOString())
        .order("created_at", { ascending: true }),
      supabase
        .from("user_badges")
        .select("badge_id, earned_at, badge_definitions(id,name,description,icon)")
        .eq("user_id", userId)
        .order("earned_at", { ascending: false })
        .limit(20),
      supabase
        .from("walk_sessions")
        .select("id,duration_seconds,steps", { count: "exact", head: false })
        .eq("user_id", userId)
        .eq("status", "completed"),
      supabase
        .from("journal_entries" as never)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

    const walks = (walksRes.data ?? []) as { started_at: string; duration_seconds: number | null; steps: number | null; mood_after_score: number | null }[];
    const entries = (entriesRes.data ?? []) as unknown as { created_at: string }[];

    const walkDaysSet = new Set<string>();
    const entryDaysSet = new Set<string>();
    const minutesByDay: Record<string, number> = {};
    for (const w of walks) {
      const day = isoDay(new Date(w.started_at));
      walkDaysSet.add(day);
      const mins = Math.round((w.duration_seconds ?? 0) / 60);
      minutesByDay[day] = (minutesByDay[day] ?? 0) + mins;
    }
    for (const e of entries) entryDaysSet.add(isoDay(new Date(e.created_at)));

    // Mood arc 30 days — average per day
    const moodByDay = new Map<string, number[]>();
    for (const w of walks) {
      if (w.mood_after_score == null) continue;
      const d = new Date(w.started_at);
      if (d < monthAgo) continue;
      const key = isoDay(d);
      const arr = moodByDay.get(key) ?? [];
      arr.push(w.mood_after_score);
      moodByDay.set(key, arr);
    }
    const moodArc30 = Array.from(moodByDay.entries())
      .map(([date, arr]) => ({ date, score: arr.reduce((s, n) => s + n, 0) / arr.length }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    const lifetimeWalksRows = (walksTotalRes.data ?? []) as { duration_seconds: number | null; steps: number | null }[];
    const lifetime = {
      entries: entriesTotalRes.count ?? 0,
      walks: lifetimeWalksRows.length,
      minutes: lifetimeWalksRows.reduce((s, w) => s + Math.round((w.duration_seconds ?? 0) / 60), 0),
      stepsLogged: lifetimeWalksRows.reduce((s, w) => s + (w.steps ?? 0), 0),
    };

    const badgeRows = (badgeRes.data ?? []) as Array<{
      earned_at: string;
      badge_definitions: { id: string; name: string; description: string | null; icon: string | null } | null;
    }>;
    const badges: JournalBadge[] = badgeRows
      .filter((r) => r.badge_definitions)
      .map((r) => ({
        id: r.badge_definitions!.id,
        name: r.badge_definitions!.name,
        description: r.badge_definitions!.description,
        icon: r.badge_definitions!.icon,
        earned_at: r.earned_at,
      }));

    return {
      lifetime,
      walkDays: Array.from(walkDaysSet),
      entryDays: Array.from(entryDaysSet),
      minutesByDay,
      moodArc30,
      badges,
      badgesCount: badges.length,
    };
  });
