import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";

const BASE_CENTS = 299;
const MIN_TOTAL_CENTS = BASE_CENTS;
const MAX_TOTAL_CENTS = 100_000 + BASE_CENTS;
const PRESETS = [299, 500, 1000, 2500];

interface Props {
  /** Selected donation (in cents). Total = base + donation. */
  value: number;
  onChange: (donationCents: number) => void;
  onConfirm: () => void;
  confirmLabel?: string;
}

/**
 * Picker for total monthly Plus contribution. Base is a fixed $2.99;
 * anything above is designated to 988. Emits donation cents (total − base).
 */
export function PlusAmountPicker({ value, onChange, onConfirm, confirmLabel = "Continue" }: Props) {
  const total = BASE_CENTS + Math.max(0, value);
  const [custom, setCustom] = useState<string>("");

  const setTotal = (cents: number) => {
    setCustom("");
    onChange(Math.max(0, cents - BASE_CENTS));
  };

  const dollars = (c: number) => `$${(c / 100).toFixed(2)}`;
  const donationCents = total - BASE_CENTS;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {PRESETS.map((c) => {
          const active = total === c && !custom;
          return (
            <button
              type="button"
              key={c}
              onClick={() => setTotal(c)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                active
                  ? "border-forest bg-forest text-primary-foreground"
                  : "border-border bg-card hover:border-forest/50"
              }`}
            >
              <div className="font-serif text-lg">{dollars(c)}</div>
              <div className="text-[11px] opacity-80">
                {c === BASE_CENTS ? "base only" : `${dollars(c - BASE_CENTS)} to 988`}
              </div>
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
            min={(MIN_TOTAL_CENTS / 100).toFixed(2)}
            step="1"
            placeholder={`${(MIN_TOTAL_CENTS / 100).toFixed(2)}+`}
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              const cents = Math.round(Number(e.target.value || 0) * 100);
              if (cents >= MIN_TOTAL_CENTS && cents <= MAX_TOTAL_CENTS) {
                onChange(cents - BASE_CENTS);
              }
            }}
            className="max-w-[140px]"
          />
          <span className="text-sm text-muted-foreground">/ month</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {dollars(BASE_CENTS)} keeps Plus running. Anything above goes to 988.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-forest/30 bg-accent/30 p-3 text-sm">
        <div>
          <div className="font-medium">{dollars(total)}/mo total</div>
          <div className="text-[11px] text-muted-foreground">
            {dollars(BASE_CENTS)} base
            {donationCents > 0 && (
              <>
                {" + "}
                <span className="inline-flex items-center gap-1 text-rose-600">
                  <Heart className="h-3 w-3" /> {dollars(donationCents)} to 988
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <Button
        type="button"
        onClick={onConfirm}
        className="w-full rounded-full bg-forest text-primary-foreground hover:opacity-90"
      >
        {confirmLabel} · {dollars(total)}/mo
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Every dollar above {dollars(BASE_CENTS)} is designated to the 988 Suicide &amp; Crisis Lifeline. Change or cancel anytime.
      </p>
    </div>
  );
}
