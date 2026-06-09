import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, ChevronRight } from "lucide-react";

interface Props {
  /** "Monthly" or "Yearly" — only used for display copy */
  current: "monthly" | "yearly";
  onSelect: (plan: "plus_monthly" | "plus_yearly") => void;
  disabled?: boolean;
}

const MONTHLY_CENTS = 199;
const YEARLY_CENTS = 1900;

export function PlanPicker({ current, onSelect, disabled }: Props) {
  const yearlySavings = MONTHLY_CENTS * 12 - YEARLY_CENTS;
  return (
    <div className="grid gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect("plus_monthly")}
        className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
          current === "monthly" ? "border-forest bg-accent/40" : "border-border bg-card hover:border-forest/40"
        } disabled:opacity-60`}
      >
        <div>
          <div className="font-medium">Monthly</div>
          <div className="text-xs text-muted-foreground">$1.99 / month</div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect("plus_yearly")}
        className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
          current === "yearly" ? "border-forest bg-accent/40" : "border-border bg-card hover:border-forest/40"
        } disabled:opacity-60`}
      >
        <div>
          <div className="flex items-center gap-2 font-medium">
            Yearly
            <span className="rounded-full bg-forest/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-forest">
              Save ${(yearlySavings / 100).toFixed(0)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            $19 / year · ~$1.58/mo · 1 month free
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}

/** Standalone dialog for switching an active monthly to yearly. */
export function SwitchToYearlyDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <Sparkles className="h-4 w-4 text-forest" /> Switch to yearly
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          $19 charged today, effective immediately. Your monthly plan ends and we'll pro-rate any unused time toward the yearly invoice.
        </p>
        <div className="mt-2 flex gap-2">
          <Button variant="outline" className="flex-1 rounded-full" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button
            disabled={loading}
            onClick={onConfirm}
            className="flex-1 rounded-full bg-forest text-primary-foreground hover:opacity-90"
          >
            {loading ? "Switching…" : "Switch to yearly"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Convenience hook: keep PlanPicker self-contained without needing more imports above.
export function usePlanPickerState(initial: "monthly" | "yearly" = "monthly") {
  return useState<"monthly" | "yearly">(initial);
}
