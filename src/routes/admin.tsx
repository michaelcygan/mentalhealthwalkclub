import { createFileRoute, Outlet, Link, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Music, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!data) throw redirect({ to: "/" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link to="/profile" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <h1 className="font-serif text-2xl">Admin</h1>
        <span className="w-12" />
      </div>
      <nav className="flex gap-2">
        <Link
          to="/admin/music"
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${path.startsWith("/admin/music") ? "border-forest bg-forest text-primary-foreground" : "border-border bg-card hover:bg-accent/40"}`}
        >
          <Music className="h-3.5 w-3.5" /> Music
        </Link>
      </nav>
      <Outlet />
    </div>
  );
}
