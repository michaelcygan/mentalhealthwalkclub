import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/collections")({
  beforeLoad: () => { throw redirect({ to: "/admin" }); },
});
