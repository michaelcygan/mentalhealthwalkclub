import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, X, Footprints, CalendarPlus } from "lucide-react";
import { haptics } from "@/lib/device";

/**
 * Floating compose button for Home. Expands into Start solo / Plan a walk.
 * Sits above the mobile tab bar (respects safe-area inset).
 */
export function HomeComposeFab() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const go = (to: "/walk" | "/events") => {
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
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 72px)" }}
      >
        {open && (
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            <FabAction
              label="Plan a walk"
              icon={<CalendarPlus className="h-4 w-4" />}
              onClick={() => go("/events")}
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
          {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
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
