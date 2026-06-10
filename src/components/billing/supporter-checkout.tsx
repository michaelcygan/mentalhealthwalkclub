import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createSupporterCheckoutSession } from "@/lib/billing.functions";

interface Props {
  amountCents: number;
  returnUrl?: string;
}

export function SupporterCheckout({ amountCents, returnUrl }: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    const finalReturn =
      returnUrl ||
      `${window.location.origin}/impact?supporter=1&session_id={CHECKOUT_SESSION_ID}`;
    const result = await createSupporterCheckoutSession({
      data: { amountCents, returnUrl: finalReturn, environment: getStripeEnvironment() },
    });
    if (!result) throw new Error("Could not start checkout");
    return result;
  };

  return (
    // key forces remount when the amount changes (clientSecret can't be swapped)
    <div id="supporter-checkout" key={amountCents}>
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
