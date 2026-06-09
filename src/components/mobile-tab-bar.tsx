import { Link, useRouterState } from "@tanstack/react-router";
import { Footprints, Compass, BookHeart, Menu } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { haptics } from "@/lib/device";

const TABS: Array<{ to: string; label: string; icon: typeof Footprints; exact?: boolean }> = [
  { to: "/", label: "Home", icon: Footprints, exact: true },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/journal", label: "Journal", icon: BookHeart },
  { to: "/more", label: "More", icon: Menu },
];

export function MobileTabBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const reduceMotion = useReducedMotion();
  const isActive = (to: string, exact?: boolean) =>
    exact ? path === to : path === to || path.startsWith(to + "/");

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4 md:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      aria-label="Primary"
    >
      <ul
        className="pointer-events-auto flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2 py-1.5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/55"
      >
        {TABS.map(({ to, label, icon: Icon, exact }) => {
          const active = isActive(to, exact);
          return (
            <li key={to}>
              <Link
                to={to as never}
                onClick={() => haptics.tap()}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className="relative block"
              >
                <motion.span
                  whileTap={{ scale: 0.9 }}
                  className={`relative flex h-11 items-center gap-1.5 rounded-full px-3 text-[12px] transition-colors ${
                    active ? "text-forest" : "text-muted-foreground"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="tab-active-pill"
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 380, damping: 32 }
                      }
                      className="absolute inset-0 -z-10 rounded-full bg-forest/12"
                      style={{ backgroundColor: "color-mix(in oklab, var(--forest) 14%, transparent)" }}
                    />
                  )}
                  <Icon
                    className="h-[18px] w-[18px] shrink-0"
                    strokeWidth={active ? 2.4 : 1.8}
                  />
                  <AnimatePresence initial={false}>
                    {active && (
                      <motion.span
                        key="label"
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, width: 0 }}
                        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, width: "auto" }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, width: 0 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className="overflow-hidden whitespace-nowrap font-medium"
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
