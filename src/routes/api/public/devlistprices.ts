import { createFileRoute } from "@tanstack/react-router";
import { createStripeClient } from "@/lib/stripe.server";

export const Route = createFileRoute("/api/public/devlistprices")({
  server: {
    handlers: {
      GET: async () => {
        const stripe = createStripeClient("sandbox");
        const products = await stripe.products.list({ limit: 100 });
        const prices = await stripe.prices.list({ limit: 100 });
        return new Response(
          JSON.stringify({
            products: products.data.map((p) => ({ id: p.id, name: p.name, metadata: p.metadata })),
            prices: prices.data.map((p) => ({
              id: p.id,
              product: p.product,
              lookup_key: p.lookup_key,
              unit_amount: p.unit_amount,
              recurring: p.recurring?.interval,
              active: p.active,
            })),
          }, null, 2),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
