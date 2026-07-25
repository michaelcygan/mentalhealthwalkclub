import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/discover")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
