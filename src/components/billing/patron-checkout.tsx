import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createPatronCheckoutSession } from "@/lib/billing.functions";

interface Props {
  amountCents: number;
  returnUrl?: string;
}

export function PatronCheckout({ amountCents, returnUrl }: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    const finalReturn =
      returnUrl ||
      `${window.location.origin}/impact?patron=1&session_id={CHECKOUT_SESSION_ID}`;
    const result = await createPatronCheckoutSession({
      data: { amountCents, returnUrl: finalReturn, environment: getStripeEnvironment() },
    });
    if (!result) throw new Error("Could not start checkout");
    return result;
  };

  return (
    // key forces remount when the amount changes (clientSecret can't be swapped)
    <div id="patron-checkout" key={amountCents}>
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
