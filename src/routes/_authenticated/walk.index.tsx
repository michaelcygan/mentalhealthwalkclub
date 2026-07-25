import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/walk/")({
  beforeLoad: () => { throw redirect({ to: "/" }); },
});
