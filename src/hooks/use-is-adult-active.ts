import { useEligibility } from "@/lib/eligibility-context";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

/**
 * Adult-active gating for signed-in flows.
 * The backend triggers are authoritative — this hook is only used to
 * disable CTAs and show a friendlier toast pointing at /confirm-age.
 */
export function useIsAdultActive() {
  const { user } = useAuth();
  const { eligibility, loading } = useEligibility();
  const isAdultActive = !!user && eligibility?.eligibilityStatus === "adult_active";
  return {
    isAdultActive,
    loading: loading && !!user,
    /** Returns true when the caller may proceed; otherwise toasts and returns false. */
    guard(message = "Confirm your age to continue.") {
      if (!user) return true; // logged-out flows handle their own age attestation
      if (isAdultActive) return true;
      toast.error(message, {
        action: {
          label: "Confirm age",
          onClick: () => {
            if (typeof window !== "undefined") window.location.assign("/confirm-age");
          },
        },
      });
      return false;
    },
  };
}
