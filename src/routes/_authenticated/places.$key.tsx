import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/places/$key")({
  beforeLoad: () => { throw redirect({ to: "/" }); },
});
