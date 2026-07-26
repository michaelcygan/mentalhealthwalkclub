import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const COVER_TTL = 60 * 60 * 24; // 1 day
export const TRACK_TTL = 60 * 60 * 2; // 2 hours (session-length)

export function serverClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export async function signCover(
  supabase: ReturnType<typeof serverClient>,
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("radio-covers").createSignedUrl(path, COVER_TTL);
  return data?.signedUrl ?? null;
}

export async function assertAdmin(context: { supabase: ReturnType<typeof serverClient>; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}
