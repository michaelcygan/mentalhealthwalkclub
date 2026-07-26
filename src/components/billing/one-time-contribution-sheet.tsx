import { useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Heart, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createOneTimeContributionSession } from "@/lib/billing.functions";
import { useAuth } from "@/lib/auth-context";

const PRESETS = [500, 1000, 2500, 5000];
const MIN = 100;
const MAX = 100_000;

interface Props {
  onCancel?: () => void;
  returnUrl?: string;
}

/** Amount + optional dedication → Stripe Embedded Checkout, all inline. */
export function OneTimeContributionSheet({ onCancel, returnUrl }: Props) {
  const { user } = useAuth();
  const [amountCents, setAmountCents] = useState<number>(1000);
  const [custom, setCustom] = useState<string>("");
  const [dedicationName, setDedicationName] = useState("");
  const [dedicationMessage, setDedicationMessage] = useState("");
  const [displayPublicly, setDisplayPublicly] = useState(false);
  const [email, setEmail] = useState(user?.email ?? "");
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dollars = (c: number) => `$${(c / 100).toFixed(0)}`;

  const setAmount = (c: number) => {
    setCustom("");
    setAmountCents(Math.max(MIN, Math.min(MAX, c)));
  };

  const canContinue = amountCents >= MIN && amountCents <= MAX && (!!user || email.length >= 3);

  const fetchClientSecret = async (): Promise<string> => {
    const finalReturn =
      returnUrl ||
      `${window.location.origin}/transparency?contribution=success&session_id={CHECKOUT_SESSION_ID}`;
    const cs = await createOneTimeContributionSession({
      data: {
        environment: getStripeEnvironment(),
        amountCents,
        email: email || undefined,
        returnUrl: finalReturn,
        dedicationName: dedicationName || undefined,
        dedicationMessage: dedicationMessage || undefined,
        displayPublicly,
      },
    });
    if (!cs) throw new Error("Checkout could not start");
    return cs;
  };

  if (started) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setStarted(false)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Change amount
        </button>
        <div id="one-time-checkout" key={amountCents}>
          <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        {PRESETS.map((c) => {
          const active = amountCents === c && !custom;
          return (
            <button
              type="button"
              key={c}
              onClick={() => setAmount(c)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                active ? "border-rose-600 bg-rose-600 text-white" : "border-border bg-card hover:border-rose-400"
              }`}
            >
              <div className="font-serif text-lg">{dollars(c)}</div>
              <div className="text-[11px] opacity-80">to 988</div>
            </button>
          );
        })}
      </div>

      <div>
        <label className="text-xs uppercase tracking-wide text-muted-foreground">Custom amount</label>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-muted-foreground">$</span>
          <Input
            type="number"
            inputMode="decimal"
            min="1"
            step="1"
            placeholder="25"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              const cents = Math.round(Number(e.target.value || 0) * 100);
              if (cents >= MIN && cents <= MAX) setAmountCents(cents);
            }}
            className="max-w-[140px]"
          />
          <span className="text-sm text-muted-foreground">USD</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">$1 minimum. 100% designated to 988.</p>
      </div>

      {!user && (
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Email for receipt</label>
          <Input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1"
          />
        </div>
      )}

      <details className="rounded-2xl border bg-card p-4">
        <summary className="cursor-pointer list-none text-sm font-medium">
          Add a dedication <span className="text-muted-foreground">(optional)</span>
        </summary>
        <div className="mt-3 space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">
              In honor of (name)
            </label>
            <Input
              value={dedicationName}
              onChange={(e) => setDedicationName(e.target.value.slice(0, 60))}
              placeholder="e.g. Sam"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">
              Message (max 240 chars)
            </label>
            <Textarea
              value={dedicationMessage}
              onChange={(e) => setDedicationMessage(e.target.value.slice(0, 240))}
              placeholder="Something to say publicly if you choose to share."
              className="mt-1 min-h-[80px]"
            />
          </div>
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={displayPublicly}
              onChange={(e) => setDisplayPublicly(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-muted-foreground">
              Show this dedication on the transparency page. We only publish your first name (max 40 chars) and the message above. Never your last name, email, or payment info.
            </span>
          </label>
        </div>
      </details>

      <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50/40 p-3 text-sm">
        <div className="flex items-center gap-2 text-rose-700">
          <Heart className="h-4 w-4" />
          <span>Contribution</span>
        </div>
        <div className="font-serif text-lg text-rose-700">{dollars(amountCents)}</div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex items-center gap-2">
        {onCancel && (
          <Button variant="outline" className="rounded-full" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          disabled={!canContinue}
          onClick={() => {
            setError(null);
            setStarted(true);
          }}
          className="flex-1 rounded-full bg-rose-600 text-white hover:opacity-90"
        >
          Continue to payment
        </Button>
      </div>
    </div>
  );
}
