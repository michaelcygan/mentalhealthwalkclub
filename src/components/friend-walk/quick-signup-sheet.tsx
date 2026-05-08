import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AuthForm } from "@/components/auth-form";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
  reason?: string;
}

export function QuickSignupSheet({ open, onOpenChange, onSuccess, reason }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-t-2 border-forest/20 bg-card pb-8 pt-6">
        <SheetHeader className="text-left">
          <SheetTitle className="font-serif text-xl">Almost in</SheetTitle>
          <SheetDescription className="text-sm">
            {reason ?? "Create a quick account to join the mic. Takes 10 seconds."}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <AuthForm
            defaultMode="signup"
            onSuccess={() => { onOpenChange(false); onSuccess?.(); }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
