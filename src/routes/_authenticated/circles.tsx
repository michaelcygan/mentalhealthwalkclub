import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/circles")({
  beforeLoad: () => { throw redirect({ to: "/groups" }); },
});
