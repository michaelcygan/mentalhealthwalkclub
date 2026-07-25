import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/listen/$id")({
  beforeLoad: () => { throw redirect({ to: "/" }); },
});
