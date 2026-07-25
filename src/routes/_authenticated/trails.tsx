import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/trails")({
  beforeLoad: () => { throw redirect({ to: "/" }); },
});
