import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createHash } from "crypto";

const BodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(255),
  status: z.enum(["going", "maybe", "declined"]).default("going"),
  ref: z.string().uuid().optional().nullable(),
  guestRef: z.string().uuid().optional().nullable(),
  // Adult-only launch: guest attests they are 18+.
  ageAttest: z.literal(true, { errorMap: () => ({ message: "You must be 18 or older to RSVP." }) }),
  // honeypot — must be empty
  website: z.string().max(0).optional(),
});

const CodeSchema = z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/);

export const Route = createFileRoute("/api/public/walk/$code/rsvp")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const code = CodeSchema.safeParse(params.code);
        if (!code.success) return new Response("bad code", { status: 400 });

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("bad body", { status: 400 });
        }
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
        }
        if (parsed.data.website && parsed.data.website.length > 0) {
          return new Response("ok", { status: 204 }); // honeypot tripped — silently 204
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { hashEmail, encryptEmail } = await import("@/lib/guest-rsvp-crypto.server");

        const { data: ev } = await supabaseAdmin
          .from("events")
          .select("id,visibility,status,title,age_realm")
          .eq("slug", code.data)
          .in("visibility", ["public", "link_only", "group"])
          .eq("status", "published")
          .maybeSingle();
        if (!ev) return new Response("not found", { status: 404 });
        if (ev.age_realm && ev.age_realm !== "adult") {
          return Response.json({ error: "This walk isn't accepting guest RSVPs." }, { status: 403 });
        }

        // Soft rate-limit per IP per event
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
        const ipHash = ip ? createHash("sha256").update(ip).digest("hex") : null;
        if (ipHash) {
          const since = new Date(Date.now() - 60_000).toISOString();
          const { count } = await supabaseAdmin
            .from("event_rsvp_guests")
            .select("id", { count: "exact", head: true })
            .eq("event_id", ev.id)
            .eq("ip_hash", ipHash)
            .gte("created_at", since);
          if ((count ?? 0) > 5) return new Response("slow down", { status: 429 });
        }

        const emailHash = hashEmail(parsed.data.email);
        const emailEnc = encryptEmail(parsed.data.email);

        const { data: row, error } = await supabaseAdmin
          .from("event_rsvp_guests")
          .upsert(
            {
              event_id: ev.id,
              name: parsed.data.name,
              email_hash: emailHash,
              email_encrypted: emailEnc,
              status: parsed.data.status,
              referred_by_rsvp_id: parsed.data.ref ?? null,
              referred_by_guest_id: parsed.data.guestRef ?? null,
              ip_hash: ipHash,
              user_agent: request.headers.get("user-agent")?.slice(0, 240) ?? null,
            },
            { onConflict: "event_id,email_hash" }
          )
          .select("id")
          .single();

        if (error) {
          console.error("guest rsvp", error);
          return Response.json({ error: error.message }, { status: 500 });
        }

        // Viral invite badge for referrer (3+ guests via their ref)
        if (parsed.data.ref) {
          const { data: rsvp } = await supabaseAdmin
            .from("event_rsvps")
            .select("user_id")
            .eq("id", parsed.data.ref)
            .maybeSingle();
          if (rsvp?.user_id) {
            const { count } = await supabaseAdmin
              .from("event_rsvp_guests")
              .select("id", { count: "exact", head: true })
              .eq("referred_by_rsvp_id", parsed.data.ref);
            if ((count ?? 0) >= 3) {
              const { data: badge } = await supabaseAdmin
                .from("badge_definitions")
                .select("id")
                .eq("key", "viral_invite")
                .maybeSingle();
              if (badge?.id) {
                await supabaseAdmin
                  .from("user_badges")
                  .upsert(
                    { user_id: rsvp.user_id, badge_id: badge.id, event_id: ev.id },
                    { onConflict: "user_id,badge_id" }
                  );
              }
            }
          }
        }

        return Response.json({ ok: true, id: row.id });
      },
    },
  },
});
