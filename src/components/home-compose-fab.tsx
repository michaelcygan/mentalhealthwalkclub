import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Footprints, X, CalendarPlus } from "lucide-react";
import { haptics } from "@/lib/device";
import { useAuth } from "@/lib/auth-context";

/**
 * Global floating compose button. Expands into Start solo / Plan a walk.
 * Mounted once in __root.tsx — gates its own visibility by auth + path.
 */

const HIDDEN_EXACT = new Set([
  "/walk",
  "/auth",
  "/welcome",
  "/privacy",
  "/terms",
  "/shop/return",
]);
const HIDDEN_PREFIX = ["/admin", "/w/", "/listen/", "/events/"];

function shouldHide(path: string) {
  if (HIDDEN_EXACT.has(path)) return true;
  if (path === "/admin") return true;
  for (const p of HIDDEN_PREFIX) {
    if (path.startsWith(p)) return true;
  }
  return false;
}

export function HomeComposeFab() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Close menu on route change.
  useEffect(() => { setOpen(false); }, [path]);

  if (!user) return null;
  if (shouldHide(path)) return null;

  const go = (to: "/walk" | "/walk/new") => {
    setOpen(false);
    haptics.tap();
    navigate({ to });
  };

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close compose"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-background/40 backdrop-blur-[2px] calm-transition"
        />
      )}

      <div
        className="pointer-events-none fixed right-4 z-50 flex flex-col items-end gap-2"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 92px)" }}
      >
        {open && (
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            <FabAction
              label="Plan a walk"
              icon={<CalendarPlus className="h-4 w-4" />}
              onClick={() => go("/walk/new")}
            />
            <FabAction
              label="Walk solo"
              icon={<Footprints className="h-4 w-4" />}
              onClick={() => go("/walk")}
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => { haptics.tap(); setOpen((v) => !v); }}
          aria-expanded={open}
          aria-label={open ? "Close compose menu" : "Start a walk"}
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-forest text-primary-foreground shadow-soft calm-transition active:scale-95 hover:opacity-90"
        >
          {open ? <X className="h-6 w-6" /> : <Footprints className="h-6 w-6" />}
        </button>
      </div>
    </>
  );
}

function FabAction({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium shadow-soft calm-transition hover:bg-accent/40"
    >
      <span className="text-forest">{icon}</span>
      {label}
    </button>
  );
}
