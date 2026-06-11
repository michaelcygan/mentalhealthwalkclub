import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => <Outlet />,
  errorComponent: AuthErrorBoundary,
});

function AuthErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-12 text-center">
      <h2 className="font-serif text-xl">Something went sideways</h2>
      <p className="text-sm text-muted-foreground">
        {error?.message ?? "An unexpected error occurred."}
      </p>
      <Button
        onClick={() => {
          reset();
          void router.invalidate();
        }}
        className="rounded-full"
      >
        Try again
      </Button>
    </div>
  );
}
