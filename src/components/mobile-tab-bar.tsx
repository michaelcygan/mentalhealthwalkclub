import { Link, useRouterState } from "@tanstack/react-router";
import { Footprints, Compass, BookHeart, User as UserIcon } from "lucide-react";
import { haptics } from "@/lib/device";

const TABS: Array<{ to: string; label: string; icon: typeof Footprints; exact?: boolean }> = [
  { to: "/", label: "Home", icon: Footprints, exact: true },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/journal", label: "Journal", icon: BookHeart },
  { to: "/profile", label: "Profile", icon: UserIcon },
];

export function MobileTabBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string, exact?: boolean) => (exact ? path === to : path === to || path.startsWith(to + "/"));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="relative border-t border-border/60 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
        <ul className="grid grid-cols-4">
          {TABS.map(({ to, label, icon: Icon, exact }) => {
            const active = isActive(to, exact);
            return (
              <li key={to}>
                <Link
                  to={to as never}
                  onClick={() => haptics.tap()}
                  className={`flex flex-col items-center gap-1 py-2.5 text-[11px] transition ${active ? "text-primary" : "text-muted-foreground"}`}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                  <span className={active ? "font-medium" : ""}>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
