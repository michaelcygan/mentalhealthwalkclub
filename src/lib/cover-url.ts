import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve a cover reference into a usable URL.
 * - Absolute URLs (http/https/data) pass through.
 * - Bare storage paths are resolved against the public `ambient-covers` bucket.
 */
export function resolveCover(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  if (/^(https?:|data:|\/)/i.test(s)) return s;
  const { data } = supabase.storage.from("ambient-covers").getPublicUrl(s);
  return data?.publicUrl ?? null;
}

/** Two-letter initials from a title, for cover fallback chips. */
export function initialsFor(title: string): string {
  const words = (title || "").split(/\s+/).filter(Boolean);
  const a = words[0]?.[0] ?? "•";
  const b = words[1]?.[0] ?? "";
  return (a + b).toUpperCase().slice(0, 2);
}
