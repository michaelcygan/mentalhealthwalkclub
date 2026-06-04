import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  type StripeEnv,
  createStripeClient,
} from "@/lib/stripe.server";

function getStripeErrorMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return "Stripe request failed";
}

const SLUG_RE = /^[a-z0-9-]{2,60}$/;

export const listMerchProducts = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data, error } = await supabaseAdmin
      .from("merch_products")
      .select("*")
      .eq("is_active", true)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

export const getMerchProduct = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => {
    if (!SLUG_RE.test(data.slug)) throw new Error("Invalid slug");
    return data;
  })
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("merch_products")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

async function requireAdmin(
  supabase: { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown }> },
  userId: string,
) {
  const { data } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (!data) throw new Error("Admin only");
}

export const adminUpsertMerchProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id?: string;
      slug: string;
      name: string;
      description?: string | null;
      price_cents: number;
      currency?: string;
      image_url?: string | null;
      inventory?: number | null;
      is_active?: boolean;
      sort?: number;
    }) => {
      if (!SLUG_RE.test(data.slug)) throw new Error("Slug must be lowercase letters/numbers/dashes");
      if (!data.name.trim() || data.name.length > 120) throw new Error("Name required (≤120 chars)");
      if (data.description && data.description.length > 2000) throw new Error("Description too long");
      if (!Number.isInteger(data.price_cents) || data.price_cents < 50) throw new Error("Price must be ≥ $0.50");
      if (data.price_cents > 1_000_000) throw new Error("Price too high");
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId as string);

    const payload = {
      slug: data.slug,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      price_cents: data.price_cents,
      currency: (data.currency || "usd").toLowerCase(),
      image_url: data.image_url || null,
      inventory: data.inventory ?? null,
      is_active: data.is_active ?? true,
      sort: data.sort ?? 0,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("merch_products")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("merch_products")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const adminDeleteMerchProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId as string);
    const { error } = await supabaseAdmin
      .from("merch_products")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListAllProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId as string);
    const { data, error } = await supabaseAdmin
      .from("merch_products")
      .select("*")
      .order("sort", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

type CheckoutResult = { clientSecret: string } | { error: string };

export const createMerchCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      productId: string;
      quantity?: number;
      returnUrl: string;
      environment: StripeEnv;
    }) => {
      if (!data.productId) throw new Error("Product required");
      const q = data.quantity ?? 1;
      if (!Number.isInteger(q) || q < 1 || q > 10) throw new Error("Quantity 1–10");
      return { ...data, quantity: q };
    },
  )
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { supabase, userId } = context;

    try {
      const { data: product, error: pErr } = await supabaseAdmin
        .from("merch_products")
        .select("*")
        .eq("id", data.productId)
        .eq("is_active", true)
        .maybeSingle();
      if (pErr) throw new Error(pErr.message);
      if (!product) throw new Error("Product not found");
      if (product.inventory != null && product.inventory < data.quantity) {
        throw new Error("Sold out");
      }

      const stripe = createStripeClient(data.environment);

      const { data: userResp } = await supabase.auth.getUser();
      const email = userResp.user?.email ?? undefined;

      // Resolve a Stripe customer carrying our userId
      let customerId: string | undefined;
      if (/^[a-zA-Z0-9_-]+$/.test(userId as string)) {
        const found = await stripe.customers.search({
          query: `metadata['userId']:'${userId}'`,
          limit: 1,
        });
        if (found.data.length) customerId = found.data[0].id;
      }
      if (!customerId && email) {
        const list = await stripe.customers.list({ email, limit: 1 });
        if (list.data.length) {
          customerId = list.data[0].id;
          if (list.data[0].metadata?.userId !== (userId as string)) {
            await stripe.customers.update(customerId, {
              metadata: { ...list.data[0].metadata, userId: userId as string },
            });
          }
        }
      }
      if (!customerId) {
        const created = await stripe.customers.create({
          ...(email && { email }),
          metadata: { userId: userId as string },
        });
        customerId = created.id;
      }

      const amountCents = product.price_cents;

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: product.currency || "usd",
              product_data: {
                name: product.name,
                ...(product.description && { description: product.description }),
                ...(product.image_url && { images: [product.image_url] }),
              },
              unit_amount: amountCents,
            },
            quantity: data.quantity,
            adjustable_quantity: { enabled: true, minimum: 1, maximum: 10 },
          },
        ],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        shipping_address_collection: { allowed_countries: ["US", "CA", "GB", "AU", "DE", "FR", "NL", "ES", "IT", "IE"] },
        payment_intent_data: { description: product.name },
        metadata: {
          userId: userId as string,
          product_id: product.id,
          product_slug: product.slug,
          kind: "merch",
        },
      });

      // Record a pending order so we can reconcile later
      await supabaseAdmin.from("merch_orders").insert({
        user_id: userId as string,
        product_id: product.id,
        quantity: data.quantity,
        amount_cents: amountCents * data.quantity,
        currency: product.currency || "usd",
        status: "pending",
        stripe_session_id: session.id,
        environment: data.environment,
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

export const listMyMerchOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("merch_orders")
      .select("id, status, quantity, amount_cents, currency, created_at, product:merch_products(name, slug, image_url)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
