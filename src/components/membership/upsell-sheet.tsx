import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { trackBillingEvent, type BillingEventType } from "@/lib/billing-analytics";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surface: "saved_reads" | "playlists" | "collections_follow" | string;
  title: string;
  body: string;
  cap?: number;
}

const SURFACE_LABEL: Record<string, string> = {
  saved_reads: "Saved reads",
  playlists: "Playlists",
  collections_follow: "Collections",
};

export function UpsellSheet({ open, onOpenChange, surface, title, body, cap }: Props) {
  const { openPlusCheckout } = useAuthPrompt();

  const fire = (e: BillingEventType) =>
    void trackBillingEvent(e, { surface, cap: cap ?? null });

  // fire shown once when opened
  if (open) fire("cap_upsell_shown");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) fire("cap_upsell_dismissed");
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-lg">
            <Sparkles className="h-4 w-4 text-forest" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{body}</p>
        {cap !== undefined && (
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {SURFACE_LABEL[surface] ?? surface} · free cap {cap}
          </p>
        )}
        <div className="mt-2 flex gap-2">
          <Button variant="outline" className="flex-1 rounded-full" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
          <Button
            className="flex-1 rounded-full bg-forest text-primary-foreground hover:opacity-90"
            onClick={() => {
              fire("cap_upsell_converted");
              onOpenChange(false);
              openPlusCheckout();
            }}
          >
            Upgrade — $2.99
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
