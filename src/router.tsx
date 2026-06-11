import { createRouter, useRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="t-eyebrow">A small stumble</p>
        <h1 className="mt-3 h-display text-foreground">Something didn't land right.</h1>
        <p className="mt-3 font-serif text-sm italic text-muted-foreground">
          Take a breath. Try again, or wander home.
        </p>

        {import.meta.env.DEV && error.message && (
          <pre className="mt-5 max-h-40 overflow-auto rounded-2xl border border-border bg-muted/60 p-3 text-left font-mono text-[11px] text-destructive">
            {error.message}
          </pre>
        )}

        <div className="mt-7 flex items-center justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-rest transition hover:opacity-90 active:scale-[0.98]"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent/40"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}


export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
};
