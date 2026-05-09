import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createPlusCheckoutSession, type PlusPlan } from "@/lib/billing.functions";

interface Props {
  returnUrl?: string;
  plan?: PlusPlan;
}

export function PlusCheckout({ returnUrl, plan = "plus_monthly" }: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    const finalReturn =
      returnUrl ||
      `${window.location.origin}/welcome?upgraded=1&session_id={CHECKOUT_SESSION_ID}`;
    const result = await createPlusCheckoutSession({
      data: { returnUrl: finalReturn, environment: getStripeEnvironment(), plan },
    });
    if (!result) throw new Error("Could not start checkout");
    return result;
  };

  return (
    // key forces remount when plan changes (clientSecret can't be swapped)
    <div id="plus-checkout" key={plan}>
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
