import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Per-theme prime-time slots (HH:MM, treated as UTC fallback)
type Slots = { weekday: string[]; weekend: string[] };

async function getConfig() {
  const { data } = await supabaseAdmin
    .from("ghost_walk_config")
    .select("key,value");
  const map: Record<string, unknown> = {};
  (data ?? []).forEach((r) => (map[r.key] = r.value));
  return map;
}

function cadenceFor(memberCount: number, tiers: Array<{ min: number; max: number; per_week: number }>) {
  const t = tiers.find((t) => memberCount >= t.min && memberCount <= t.max);
  return t?.per_week ?? 0;
}

function slotsFor(theme: string | null, primeSlots: Record<string, Slots>): Slots {
  return primeSlots[theme ?? "default"] ?? primeSlots.default;
}

function pickSlot(slots: Slots, baseDate: Date): Date {
  const day = baseDate.getUTCDay();
  const pool = day === 0 || day === 6 ? slots.weekend : slots.weekday;
  const choice = pool[Math.floor(Math.random() * pool.length)];
  const [h, m] = choice.split(":").map(Number);
  const d = new Date(baseDate);
  d.setUTCHours(h, m, 0, 0);
  return d;
}

function interpolateTitle(pattern: string, group: { city?: string | null; name: string }) {
  return pattern.replace("{city}", group.city || group.name);
}

export const Route = createFileRoute("/api/public/hooks/seed-walks")({
  server: {
    handlers: {
      POST: async () => {
        const startedAt = Date.now();
        const config = await getConfig();
        const tiers = config.cadence_tiers as Array<{ min: number; max: number; per_week: number }>;
        const primeSlots = config.prime_slots as Record<string, Slots>;
        const lookaheadHours = (config.lookahead_hours as number) ?? 72;
        const minGapMin = (config.min_gap_minutes as number) ?? 120;

        // Single-flight lock
        const { data: lockRow } = await supabaseAdmin.rpc("pg_try_advisory_lock" as never, {
          key: 982341,
        } as never).single() as unknown as { data: boolean | null };
        // RPC may not exist; fall through if it errors. Idempotency relies on gap checks below.

        // Eligible groups: active + member_count >= smallest tier
        const minMembers = Math.min(...tiers.map((t) => t.min));
        const { data: groups } = await supabaseAdmin
          .from("groups")
          .select("id,slug,name,city,theme,member_count,ghost_cadence_override")
          .eq("is_active", true)
          .gte("member_count", minMembers)
          .limit(500);

        let scheduled = 0;
        let skipped = 0;
        const lookaheadMs = lookaheadHours * 60 * 60 * 1000;
        const now = new Date();
        const horizon = new Date(Date.now() + lookaheadMs);

        for (const g of groups ?? []) {
          if (Date.now() - startedAt > 25_000) break; // soft budget

          const target = g.ghost_cadence_override ?? cadenceFor(g.member_count, tiers);
          if (!target) continue;

          // Count existing seed walks in lookahead window
          const { count: existingCount } = await supabaseAdmin
            .from("events")
            .select("id", { head: true, count: "exact" })
            .eq("group_id", g.id)
            .eq("is_seed", true)
            .eq("status", "published")
            .gte("starts_at", now.toISOString())
            .lte("starts_at", horizon.toISOString());

          // Convert per-week target → expected over lookahead
          const expected = Math.max(1, Math.round((target * lookaheadHours) / (7 * 24)));
          if ((existingCount ?? 0) >= expected) {
            skipped++;
            continue;
          }

          // Pick host
          const { data: assignments } = await supabaseAdmin
            .from("ghost_host_assignments")
            .select("host_user_id")
            .eq("group_id", g.id);
          if (!assignments?.length) {
            skipped++;
            continue;
          }
          const hostId = assignments[Math.floor(Math.random() * assignments.length)].host_user_id;

          // Pick template (theme match, fallback to connection)
          const { data: templates } = await supabaseAdmin
            .from("walk_templates")
            .select("title_pattern,description,length_minutes,vibe")
            .eq("is_active", true)
            .in("theme", [g.theme ?? "connection", "connection"]);
          if (!templates?.length) {
            skipped++;
            continue;
          }
          const tpl = templates[Math.floor(Math.random() * templates.length)];

          // Pick slot — random day within lookahead, then prime time
          const dayOffset = 1 + Math.floor(Math.random() * Math.max(1, Math.floor(lookaheadHours / 24) - 1));
          const baseDay = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
          const startsAt = pickSlot(slotsFor(g.theme, primeSlots), baseDay);
          if (startsAt < now) continue;

          // Gap check
          const gapWindowStart = new Date(startsAt.getTime() - minGapMin * 60_000).toISOString();
          const gapWindowEnd = new Date(startsAt.getTime() + minGapMin * 60_000).toISOString();
          const { count: nearbyCount } = await supabaseAdmin
            .from("events")
            .select("id", { head: true, count: "exact" })
            .eq("group_id", g.id)
            .eq("status", "published")
            .gte("starts_at", gapWindowStart)
            .lte("starts_at", gapWindowEnd);
          if ((nearbyCount ?? 0) > 0) {
            skipped++;
            continue;
          }

          const title = interpolateTitle(tpl.title_pattern, g);
          const slug = `seed-${g.slug}-${startsAt.toISOString().slice(0, 16).replace(/[-:T]/g, "")}`;
          const endsAt = new Date(startsAt.getTime() + (tpl.length_minutes ?? 45) * 60_000);

          const { error } = await supabaseAdmin.from("events").insert({
            slug,
            title,
            description: tpl.description,
            event_type: "audio_walk",
            status: "published",
            visibility: "public",
            host_user_id: hostId,
            group_id: g.id,
            city: g.city,
            vibe: tpl.vibe,
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            is_seed: true,
          });
          if (error) {
            console.error("seed-walks insert failed", g.slug, error.message);
            skipped++;
            continue;
          }
          scheduled++;
        }

        // Best-effort unlock if we acquired
        if (lockRow) {
          await supabaseAdmin.rpc("pg_advisory_unlock" as never, { key: 982341 } as never);
        }

        return Response.json({
          ok: true,
          scanned: groups?.length ?? 0,
          scheduled,
          skipped,
          ms: Date.now() - startedAt,
        });
      },
    },
  },
});
