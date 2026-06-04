import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarPlus, Footprints } from "lucide-react";

export const Route = createFileRoute("/events")({
  component: EventsPlaceholder,
  head: () => ({ meta: [{ title: "Walks — Mental Health Walk Club" }] }),
});

type Intent = { trail_id: string; lat: number; lng: number; label: string };

function EventsPlaceholder() {
  const [intent, setIntent] = useState<Intent | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("walk_create_intent");
      if (raw) setIntent(JSON.parse(raw) as Intent);
    } catch { /* ignore */ }
  }, []);

  function clearIntent() {
    sessionStorage.removeItem("walk_create_intent");
    setIntent(null);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-16 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent">
        <CalendarPlus className="h-6 w-6 text-forest" />
      </div>
      <h1 className="font-serif text-3xl">Walks are rebuilding.</h1>
      <p className="text-muted-foreground">
        The new walk page — a beautiful, sharable invite with weather, a map, and RSVPs — is on its way.
      </p>

      {intent && (
        <div className="mx-4 rounded-3xl border border-border bg-card p-4 text-left text-sm shadow-soft">
          <div className="mb-2 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-forest">
            <Footprints className="h-3 w-3" /> Trail picked
          </div>
          <p className="font-medium">{intent.label}</p>
          <p className="text-[11px] text-muted-foreground">
            {intent.lat.toFixed(3)}, {intent.lng.toFixed(3)}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            We'll pre-fill this location when walk creation ships.
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              to="/trails/$id"
              params={{ id: intent.trail_id }}
              className="rounded-full border border-border px-3 py-1 text-[11px] hover:bg-accent/40"
            >
              View trail
            </Link>
            <button
              type="button"
              onClick={clearIntent}
              className="rounded-full px-3 py-1 text-[11px] text-muted-foreground hover:bg-accent/40"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground/70">Phase 2 of the rebuild.</p>
    </div>
  );
}
