import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/trails/$id")({
  beforeLoad: () => { throw redirect({ to: "/" }); },
});
