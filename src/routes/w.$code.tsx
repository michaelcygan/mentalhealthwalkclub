import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/w/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `walk · ${params.code}` },
      { name: "description", content: "Walk invite — Mental Health Walk Club" },
    ],
  }),
  component: WalkCodeLanding,
});

function WalkCodeLanding() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div className="max-w-md space-y-5">
        <h1 className="font-serif text-3xl">Walk pages are being rebuilt.</h1>
        <p className="text-muted-foreground">
          The new sharable walk page — with a map, weather, and one-tap RSVP — is on its way.
        </p>
        <Link to="/" className="inline-flex items-center justify-center rounded-full bg-forest px-5 py-2.5 text-sm text-primary-foreground hover:opacity-90">
          Go to the club
        </Link>
      </div>
    </div>
  );
}
