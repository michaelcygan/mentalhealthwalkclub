import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/shop/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: ShopReturn,
});

function ShopReturn() {
  const { session_id } = Route.useSearch();
  return (
    <div className="mx-auto max-w-md space-y-4 py-12 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-forest" />
      <h1 className="font-serif text-2xl">Thanks for your order</h1>
      <p className="text-sm text-muted-foreground">
        {session_id
          ? "We're putting it together now. You'll get an email with shipping details soon."
          : "We couldn't find your session info — please check your email for a receipt."}
      </p>
      <div className="flex justify-center gap-2">
        <Link
          to="/shop"
          className="rounded-full border border-border bg-card px-4 py-2 text-sm hover:bg-accent"
        >
          Back to shop
        </Link>
        <Link
          to="/profile"
          className="rounded-full border border-border bg-card px-4 py-2 text-sm hover:bg-accent"
        >
          Your profile
        </Link>
      </div>
    </div>
  );
}
