import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  value: number;
  onChange: (cents: number) => void;
  onConfirm: () => void;
  confirmLabel?: string;
}

const FALLBACK_AMOUNTS = [300, 500, 1000, 2500];

export function SupporterAmountPicker({ value, onChange, onConfirm, confirmLabel = "Continue" }: Props) {
  const [amounts, setAmounts] = useState<number[]>(FALLBACK_AMOUNTS);
  const [minCents, setMinCents] = useState(300);
  const [custom, setCustom] = useState<string>("");

  useEffect(() => {
    let active = true;
    supabase
      .from("membership_settings" as never)
      .select("supporter_suggested_amounts, supporter_min_cents")
      .eq("id", true)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        const d = data as unknown as { supporter_suggested_amounts?: number[]; supporter_min_cents?: number };
        if (Array.isArray(d.supporter_suggested_amounts) && d.supporter_suggested_amounts.length) {
          setAmounts(d.supporter_suggested_amounts);
        }
        if (typeof d.supporter_min_cents === "number") setMinCents(d.supporter_min_cents);
      });
    return () => {
      active = false;
    };
  }, []);

  const setAmount = (cents: number) => {
    setCustom("");
    onChange(cents);
  };

  const minDollars = (minCents / 100).toFixed(0);
  const tooSmall = value < minCents;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {amounts.map((c) => (
          <button
            type="button"
            key={c}
            onClick={() => setAmount(c)}
            className={`rounded-2xl border px-4 py-3 text-left transition ${
              value === c && !custom
                ? "border-forest bg-forest text-primary-foreground"
                : "border-border bg-card hover:border-forest/50"
            }`}
          >
            <div className="font-serif text-lg">${(c / 100).toFixed(0)}</div>
            <div className="text-[11px] opacity-80">per month</div>
          </button>
        ))}
      </div>

      <div>
        <label className="text-xs uppercase tracking-wide text-muted-foreground">Custom amount</label>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-muted-foreground">$</span>
          <Input
            type="number"
            inputMode="decimal"
            min={minDollars}
            step="1"
            placeholder={`${minDollars}+`}
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              const cents = Math.round(Number(e.target.value || 0) * 100);
              if (cents > 0) onChange(cents);
            }}
            className="max-w-[140px]"
          />
          <span className="text-sm text-muted-foreground">/ month</span>
        </div>
        {tooSmall && (
          <p className="mt-1 text-xs text-clay">Minimum is ${minDollars}/month.</p>
        )}
      </div>

      <Button
        type="button"
        onClick={onConfirm}
        disabled={tooSmall}
        className="w-full rounded-full bg-forest text-primary-foreground hover:opacity-90"
      >
        {confirmLabel} · ${(value / 100).toFixed(0)}/mo
      </Button>
      <p className="text-[11px] text-muted-foreground">
        100% of profits go to our nonprofit partner. Cancel or change anytime.
      </p>
    </div>
  );
}
