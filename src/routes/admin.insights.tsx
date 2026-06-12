import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/insights")({
  beforeLoad: () => { throw redirect({ to: "/admin/analytics" }); },
  component: () => null,
});
