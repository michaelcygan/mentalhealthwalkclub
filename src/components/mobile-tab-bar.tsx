import { useEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Footprints, Users, Calendar, BookHeart, Home } from "lucide-react";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import { useLiveCount } from "@/hooks/use-live-count";
import { haptics } from "@/lib/device";
import { useWalkComposer } from "@/components/walk-composer/use-walk-composer";

/** CSS var name written so the LiveActivityPill can stack above the bar. */
const TABBAR_VAR = "--tabbar-h";

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

  // Publish the current bar height (incl. safe area) as a CSS var so other
  // fixed UI (LiveActivityPill) can stack above it without overlap, even
  // when the bar auto-hides on scroll-down.
  const barRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const update = () => {
      const visible = !hidden && !onActiveWalk && window.matchMedia("(max-width: 767px)").matches;
      const h = visible && barRef.current ? barRef.current.getBoundingClientRect().height : 0;
      root.style.setProperty(TABBAR_VAR, `${Math.round(h)}px`);
    };
    update();
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
    };
  }, [hidden, onActiveWalk]);

  return (
    <nav
      ref={barRef as React.RefObject<HTMLElement>}
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

function LongPressFab({ liveCount, composer, walkActive }: { liveCount: number; composer: ReturnType<typeof useWalkComposer>; walkActive: boolean }) {
  const timerRef = useRef<number | null>(null);
  const triggeredRef = useRef(false);

  const start = () => {
    triggeredRef.current = false;
    timerRef.current = window.setTimeout(() => {
      triggeredRef.current = true;
      haptics.success();
      composer.open({ type: "audio" });
    }, 480);
  };
  const cancel = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };
  const onClick = () => {
    if (triggeredRef.current) { triggeredRef.current = false; return; }
    haptics.tap();
    composer.open();
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        aria-label="New walk — long-press for Walk & Talk"
        className="group relative -mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-forest text-primary-foreground shadow-elevated ring-4 ring-background transition active:scale-95"
      >
        {liveCount > 0 && (
          <span aria-hidden className="pointer-events-none absolute inset-0 -m-0.5 rounded-full pulse-ring" />
        )}
        <Footprints className="h-6 w-6" strokeWidth={2.2} />
        {liveCount > 0 && (
          <span className="absolute -top-1 right-1.5 flex items-center gap-0.5 rounded-full bg-clay px-1.5 py-0.5 text-[9px] font-semibold leading-none text-background shadow">
            <span className="h-1.5 w-1.5 rounded-full bg-background/90" />
            {liveCount}
          </span>
        )}
      </button>
      <span className={`absolute bottom-1 text-[10px] font-medium ${walkActive ? "text-primary" : "text-muted-foreground"}`}>Walk</span>
    </>
  );
}
