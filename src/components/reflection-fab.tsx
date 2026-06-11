import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { PenLine } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ReflectionWriteSheet } from "@/components/home/reflection-write-sheet";

// Routes that own the bottom-right corner or otherwise hide the FAB.
const HIDDEN_EXACT = new Set(["/auth", "/welcome", "/journal", "/more"]);
const HIDDEN_PREFIX = ["/w/", "/walk/", "/auth"];

/** Global "quick reflection" composer button. */
export function ReflectionFab() {
  const { user } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  if (!user) return null;
  if (HIDDEN_EXACT.has(path)) return null;
  for (const p of HIDDEN_PREFIX) if (path.startsWith(p)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Write a reflection"
        className="fixed right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-forest text-primary-foreground shadow-[0_10px_30px_-10px_rgba(0,0,0,0.45)] ring-1 ring-black/5 transition active:scale-95 hover:opacity-90 md:hidden"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 140px)" }}
      >
        <PenLine className="h-5 w-5" />
      </button>
      <ReflectionWriteSheet open={open} onOpenChange={setOpen} source="home_reflection" />
    </>
  );
}
