import { createFileRoute, Outlet, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Headphones, ShoppingBag, CalendarDays, BookOpen, Sparkles, BarChart3, Heart } from "lucide-react";

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
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link to="/profile" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <h1 className="font-serif text-2xl">Admin</h1>
        <span className="w-12" />
      </div>
      <nav className="flex flex-wrap gap-2">
        <Link
          to="/admin/events"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-accent [&.active]:border-forest [&.active]:bg-forest [&.active]:text-primary-foreground"
          activeProps={{ className: "active" }}
        >
          <CalendarDays className="h-3.5 w-3.5" /> Events
        </Link>
        <Link
          to="/admin/podcasts"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-accent [&.active]:border-forest [&.active]:bg-forest [&.active]:text-primary-foreground"
          activeProps={{ className: "active" }}
        >
          <Headphones className="h-3.5 w-3.5" /> Podcasts
        </Link>
        <Link
          to="/admin/blogs"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-accent [&.active]:border-forest [&.active]:bg-forest [&.active]:text-primary-foreground"
          activeProps={{ className: "active" }}
        >
          <BookOpen className="h-3.5 w-3.5" /> Blogs
        </Link>
        <Link
          to="/admin/collections"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-accent [&.active]:border-forest [&.active]:bg-forest [&.active]:text-primary-foreground"
          activeProps={{ className: "active" }}
        >
          <Sparkles className="h-3.5 w-3.5" /> Collections
        </Link>
        <Link
          to="/admin/insights"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-accent [&.active]:border-forest [&.active]:bg-forest [&.active]:text-primary-foreground"
          activeProps={{ className: "active" }}
        >
          <BarChart3 className="h-3.5 w-3.5" /> Insights
        </Link>
        <Link
          to="/admin/membership"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-accent [&.active]:border-forest [&.active]:bg-forest [&.active]:text-primary-foreground"
          activeProps={{ className: "active" }}
        >
          <Heart className="h-3.5 w-3.5" /> Membership
        </Link>
        <Link
          to="/admin/merch"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-accent [&.active]:border-forest [&.active]:bg-forest [&.active]:text-primary-foreground"
          activeProps={{ className: "active" }}
        >
          <ShoppingBag className="h-3.5 w-3.5" /> Merch
        </Link>
      </nav>
      <Outlet />
    </div>
  );
}
