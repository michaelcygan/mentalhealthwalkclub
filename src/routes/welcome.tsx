import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy onboarding route. The unified entry flow now lives at "/".
 * Preserve the `?upgraded=1` flag so the post-checkout banner still surfaces.
 */
export const Route = createFileRoute("/welcome")({
  validateSearch: (search: Record<string, unknown>): { upgraded?: string; session_id?: string } => ({
    upgraded: typeof search.upgraded === "string" ? search.upgraded : undefined,
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/" as never, search: search as never });
  },
});
