import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/events/$slug")({
  component: EventDetailPlaceholder,
  head: () => ({ meta: [{ title: "Walk — Mental Health Walk Club" }] }),
});

function EventDetailPlaceholder() {
  return (
    <div className="mx-auto max-w-lg space-y-5 py-16 text-center">
      <h1 className="font-serif text-3xl">This walk page is being rebuilt.</h1>
      <p className="text-muted-foreground">
        We're redesigning walk pages from the ground up — back soon.
      </p>
      <Link to="/" className="inline-flex items-center justify-center rounded-full bg-forest px-5 py-2.5 text-sm text-primary-foreground hover:opacity-90">
        Go home
      </Link>
    </div>
  );
}
