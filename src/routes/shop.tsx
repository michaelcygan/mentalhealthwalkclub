import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { listMerchProducts, createMerchCheckoutSession } from "@/lib/merch.functions";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { ShoppingBag, Loader2, X } from "lucide-react";

export const Route = createFileRoute("/shop")({
  component: ShopPage,
  head: () => ({
    meta: [
      { title: "Shop — Mental Health Walk Club" },
      { name: "description", content: "Small-batch goods made for walkers. Half of every dollar funds mental-health nonprofits." },
      { property: "og:title", content: "Shop — Mental Health Walk Club" },
      { property: "og:description", content: "Small-batch goods made for walkers. Half of every dollar funds mental-health nonprofits." },
      { property: "og:url", content: "https://mentalhealthwalkclub.com/shop" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://mentalhealthwalkclub.com/__l5e/assets-v1/7a90bd38-5bbe-4fc5-8eb1-3d80cb7cad77/og-default.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://mentalhealthwalkclub.com/__l5e/assets-v1/7a90bd38-5bbe-4fc5-8eb1-3d80cb7cad77/og-default.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://mentalhealthwalkclub.com/shop" }],
  }),
});

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  image_url: string | null;
  inventory: number | null;
}

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

function ShopPage() {
  const list = useServerFn(listMerchProducts);
  const { data: products, isLoading } = useQuery({
    queryKey: ["merch", "products"],
    queryFn: () => list(),
  });
  const [checkoutFor, setCheckoutFor] = useState<Product | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  return (
    <div className="space-y-6">
      <PaymentTestModeBanner />
      <header className="space-y-1">
        <h1 className="font-serif text-3xl">Shop</h1>
        <p className="text-sm text-muted-foreground">
          Small-batch goods made for walkers. Half of every dollar funds mental-health nonprofits.
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !products || products.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          <ShoppingBag className="mx-auto mb-2 h-6 w-6" />
          Nothing in the shop yet. Check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(products as Product[]).map((p) => (
            <article key={p.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="aspect-square w-full bg-accent">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ShoppingBag className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-serif text-lg leading-tight">{p.name}</h2>
                  <div className="shrink-0 text-sm font-medium">{formatPrice(p.price_cents, p.currency)}</div>
                </div>
                {p.description && (
                  <p className="line-clamp-3 text-xs text-muted-foreground">{p.description}</p>
                )}
                {p.inventory != null && p.inventory <= 5 && p.inventory > 0 && (
                  <div className="text-[11px] text-muted-foreground">Only {p.inventory} left</div>
                )}
                {signedIn === false ? (
                  <Button asChild size="sm" className="w-full rounded-xl">
                    <Link to="/auth" search={{ next: "/shop" }}>Sign in to buy</Link>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full rounded-xl"
                    disabled={p.inventory === 0}
                    onClick={() => setCheckoutFor(p)}
                  >
                    {p.inventory === 0 ? "Sold out" : "Buy"}
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {checkoutFor && (
        <CheckoutOverlay product={checkoutFor} onClose={() => setCheckoutFor(null)} />
      )}

      <p className="pt-4 text-center text-xs text-muted-foreground">
        Shipping included to most countries. Refunds within 30 days.{" "}
        <Link to="/impact" className="underline">See impact →</Link>
      </p>
    </div>
  );
}

function CheckoutOverlay({ product, onClose }: { product: Product; onClose: () => void }) {
  const create = useServerFn(createMerchCheckoutSession);

  const fetchClientSecret = async (): Promise<string> => {
    const result = await create({
      data: {
        productId: product.id,
        quantity: 1,
        returnUrl: `${window.location.origin}/shop/return?session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("No client secret returned");
    return result.clientSecret;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="relative w-full max-w-lg overflow-hidden rounded-t-2xl border border-border bg-card sm:rounded-2xl">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full bg-card/90 p-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="max-h-[85vh] overflow-y-auto p-4">
          <div className="mb-3 font-serif text-lg">Checkout — {product.name}</div>
          <div id="merch-checkout" key={product.id}>
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
