import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

export const createJournalEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }): Promise<JournalEntry> => {
    const { supabase, userId } = context;
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
