import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createPlusCheckoutSession } from "@/lib/billing.functions";

interface Props {
  returnUrl?: string;
}

export function PlusCheckout({ returnUrl }: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    const finalReturn =
      returnUrl ||
      `${window.location.origin}/welcome?upgraded=1&session_id={CHECKOUT_SESSION_ID}`;
    const result = await createPlusCheckoutSession({
      data: { returnUrl: finalReturn, environment: getStripeEnvironment() },
    });
    if (!result) throw new Error("Could not start checkout");
    return result;
  };

  return (
    <div id="plus-checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
