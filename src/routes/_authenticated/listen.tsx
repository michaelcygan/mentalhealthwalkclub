import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/listen")({
  beforeLoad: () => { throw redirect({ to: "/" }); },
});
