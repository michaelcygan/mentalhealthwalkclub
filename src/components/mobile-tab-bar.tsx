import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Footprints, Compass, BookHeart, Menu, Plus, CalendarPlus, PenLine } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { haptics } from "@/lib/device";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";

const TABS: Array<{ to: string; label: string; icon: typeof Footprints; exact?: boolean }> = [
  { to: "/", label: "Home", icon: Footprints, exact: true },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/journal", label: "Journal", icon: BookHeart },
  { to: "/more", label: "More", icon: Menu },
];

const COMPOSE_HIDDEN_EXACT = new Set(["/walk", "/auth", "/welcome", "/privacy", "/terms", "/shop/return"]);
const COMPOSE_HIDDEN_PREFIX = ["/admin", "/w/", "/listen/", "/events/"];

function composeAllowed(path: string) {
  if (COMPOSE_HIDDEN_EXACT.has(path)) return false;
  if (path === "/admin") return false;
  for (const p of COMPOSE_HIDDEN_PREFIX) if (path.startsWith(p)) return false;
  return true;
}

export function MobileTabBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openAuth } = useAuthPrompt();
  const reduceMotion = useReducedMotion();
  const [composeOpen, setComposeOpen] = useState(false);

  const isActive = (to: string, exact?: boolean) =>
    exact ? path === to : path === to || path.startsWith(to + "/");

  useEffect(() => { setComposeOpen(false); }, [path]);
  useEffect(() => {
    if (!composeOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setComposeOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [composeOpen]);

  const showCompose = composeAllowed(path);
  const go = (to: "/walk" | "/walk/new" | "/journal") => {
    setComposeOpen(false);
    haptics.tap();
    navigate({ to });
  };

  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  return (
    <>
      {composeOpen && (
        <button
          type="button"
          aria-label="Close compose menu"
          onClick={() => setComposeOpen(false)}
          className="fixed inset-0 z-40 bg-background/40 backdrop-blur-[2px] md:hidden"
        />
      )}

      <nav
        className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4 md:hidden"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        aria-label="Primary"
      >
        <AnimatePresence>
          {composeOpen && (
            <motion.div
              key="compose-actions"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              role="menu"
              className="pointer-events-auto flex flex-col items-center gap-2"
            >
              <ComposeAction label="Write a reflection" sub="Open your journal" icon={<PenLine className="h-4 w-4" />} onClick={() => go("/journal")} />
              <ComposeAction label="Plan a walk" sub="Group or future walk" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => go("/walk/new")} />
              <ComposeAction label="Walk now" sub="Solo · starts the timer" icon={<Footprints className="h-4 w-4" />} onClick={() => go("/walk")} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pointer-events-auto relative flex w-full max-w-sm items-center rounded-full border border-border/60 bg-background/70 px-2 py-1.5 shadow-floating backdrop-blur-xl supports-[backdrop-filter]:bg-background/55">
          <ul className="flex flex-1 items-center justify-around gap-1 pr-7">
            {left.map((t) => (
              <TabItem key={t.to} {...t} side="left" active={isActive(t.to, t.exact)} reduceMotion={!!reduceMotion} />
            ))}
          </ul>

          <ul className="flex flex-1 items-center justify-around gap-1 pl-7">
            {right.map((t) => (
              <TabItem key={t.to} {...t} side="right" active={isActive(t.to, t.exact)} reduceMotion={!!reduceMotion} />
            ))}
          </ul>

          {showCompose && (
            <motion.button
              type="button"
              onClick={() => {
                haptics.tap();
                if (!user) { openAuth("signup"); return; }
                setComposeOpen((v) => !v);
              }}
              whileTap={{ scale: 0.9 }}
              aria-expanded={composeOpen}
               aria-haspopup="menu"
              aria-label={composeOpen ? "Close compose menu" : "Start or plan a walk"}
              className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-forest text-primary-foreground shadow-[0_10px_24px_-8px_color-mix(in_oklab,var(--forest)_70%,transparent)] ring-4 ring-background/70 transition active:scale-95"
              style={{ marginTop: "-4px" }}
            >
              <motion.span
                animate={{ rotate: composeOpen ? 45 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="grid place-items-center"
              >
                <Plus className="h-5 w-5" strokeWidth={2.4} />
              </motion.span>
            </motion.button>
          )}
        </div>
      </nav>
    </>
  );
}

function TabItem({
  to,
  label,
  icon: Icon,
  active,
  reduceMotion,
  side,
}: {
  to: string;
  label: string;
  icon: typeof Footprints;
  active: boolean;
  reduceMotion: boolean;
  side: "left" | "right";
}) {
  return (
    <li>
      <Link
        to={to as never}
        onClick={() => haptics.tap()}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className="relative block"
      >
        <motion.span
          whileTap={{ scale: 0.9 }}
          className={`relative flex h-11 min-w-11 items-center gap-1.5 rounded-full px-3 text-[12px] transition-colors ${
            active ? "text-forest" : "text-muted-foreground"
          }`}
        >
          {active && (
            <motion.span
              layoutId={`tab-active-pill-${side}`}
              transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
              className="absolute inset-0 -z-10 rounded-full"
              style={{ backgroundColor: "color-mix(in oklab, var(--forest) 14%, transparent)" }}
            />
          )}
          <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.4 : 1.8} />
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
}

function ComposeAction({ label, sub, icon, onClick }: { label: string; sub: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2 rounded-full border border-border/60 bg-background/85 px-4 py-2.5 text-sm font-medium shadow-floating backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 hover:bg-accent/50"
    >
      <span className="text-forest">{icon}</span>
       <span className="text-left"><span className="block">{label}</span><span className="block text-[10px] font-normal text-muted-foreground">{sub}</span></span>
    </button>
  );
}
