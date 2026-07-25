import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/read/$postId")({
  beforeLoad: () => {
    throw redirect({ to: "/blog" });
  },
});
