import { createFileRoute } from "@tanstack/react-router";
import { CalendarPlus } from "lucide-react";

export const Route = createFileRoute("/events")({
  component: EventsPlaceholder,
  head: () => ({ meta: [{ title: "Walks — Mental Health Walk Club" }] }),
});

function EventsPlaceholder() {
  return (
    <div className="mx-auto max-w-lg space-y-6 py-16 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent">
        <CalendarPlus className="h-6 w-6 text-forest" />
      </div>
      <h1 className="font-serif text-3xl">Walks are rebuilding.</h1>
      <p className="text-muted-foreground">
        The new walk page — a beautiful, sharable invite with weather, a map, and RSVPs — is on its way.
      </p>
      <p className="text-xs text-muted-foreground/70">Phase 2 of the rebuild.</p>
    </div>
  );
}
