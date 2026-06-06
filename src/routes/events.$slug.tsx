import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/events/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/w/$code", params: { code: params.slug } });
  },
});
