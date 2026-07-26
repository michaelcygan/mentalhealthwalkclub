import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createPlusCheckoutSession } from "@/lib/billing.functions";

interface Props {
  /** Voluntary donation on top of the $2.99 base, in cents. */
  donationCents?: number;
  returnUrl?: string;
}

export function PlusCheckout({ donationCents = 0, returnUrl }: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    const finalReturn =
      returnUrl ||
      `${window.location.origin}/welcome?upgraded=1&session_id={CHECKOUT_SESSION_ID}`;
    const result = await createPlusCheckoutSession({
      data: { returnUrl: finalReturn, environment: getStripeEnvironment(), donationCents },
    });
    if (!result) throw new Error("Could not start checkout");
    return result;
  };

  return (
    // key forces remount when donation changes (clientSecret can't be swapped)
    <div id="plus-checkout" key={donationCents}>
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
