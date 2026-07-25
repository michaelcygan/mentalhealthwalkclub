import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/podcasts/$feedId")({
  beforeLoad: () => { throw redirect({ to: "/admin" }); },
});
