import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/places")({
  beforeLoad: () => { throw redirect({ to: "/" }); },
});
