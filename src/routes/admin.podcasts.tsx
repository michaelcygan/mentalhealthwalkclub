import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/podcasts")({
  beforeLoad: () => { throw redirect({ to: "/admin" }); },
});
