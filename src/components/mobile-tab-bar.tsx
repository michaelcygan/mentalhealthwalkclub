import { useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Footprints, Users, Calendar, BookHeart, Home } from "lucide-react";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { useLiveCount } from "@/hooks/use-live-count";
import { haptics } from "@/lib/device";
import { useWalkComposer } from "@/components/walk-composer/use-walk-composer";

const SIDE_TABS: Array<{ to: string; label: string; icon: typeof Users; exact?: boolean }> = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/groups", label: "Groups", icon: Users },
  { to: "/events", label: "Events", icon: Calendar },
  { to: "/journal", label: "Journal", icon: BookHeart },
];

/** Adaptive mobile bottom bar — 4 flat tabs flanking a center Walk FAB. */
export function MobileTabBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const scrollDir = useScrollDirection();
  // Hide entirely while on a live walk so the Pause/End controls aren't clipped
  const onActiveWalk = path.startsWith("/walk/active/");
  const hidden = scrollDir === "down" || onActiveWalk;
  const isActive = (to: string, exact?: boolean) => (exact ? path === to : path === to || path.startsWith(to + "/"));

  const liveCount = useLiveCount();
  const composer = useWalkComposer();

  const walkActive = false;

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-40 md:hidden transition-transform duration-300 ${hidden ? "translate-y-full" : "translate-y-0"}`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      {/* Solid floor (with subtle blur) so content can't bleed through */}
      <div className="relative border-t border-border/60 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
        <ul className="grid grid-cols-5 items-end">
          {/* Left two */}
          {SIDE_TABS.slice(0, 2).map(({ to, label, icon: Icon, exact }) => (
            <TabItem key={to} to={to} label={label} Icon={Icon} active={isActive(to, exact)} />
          ))}

          {/* Center FAB slot — opens the unified Walk Composer */}
          <li className="relative flex justify-center">
            <LongPressFab liveCount={liveCount} composer={composer} walkActive={walkActive} />
          </li>

          {/* Right two */}
          {SIDE_TABS.slice(2).map(({ to, label, icon: Icon, exact }) => (
            <TabItem key={to} to={to} label={label} Icon={Icon} active={isActive(to, exact)} />
          ))}
        </ul>
      </div>
    </nav>
  );
}

function TabItem({ to, label, Icon, active }: { to: string; label: string; Icon: typeof Users; active: boolean }) {
  return (
    <li>
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
}
