import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/blogs")({
  beforeLoad: () => { throw redirect({ to: "/admin/blog" }); },
});
