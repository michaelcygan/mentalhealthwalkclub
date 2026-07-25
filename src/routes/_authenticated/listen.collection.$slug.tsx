import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/listen/collection/$slug")({
  beforeLoad: () => { throw redirect({ to: "/" }); },
});
