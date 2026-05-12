import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Radio, Users, Footprints } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { haptics } from "@/lib/device";

interface ActiveWalk {
  walkId: string;
  startedAt: number;
  roomTitle: string | null;
  participantCount: number | null;
}

const COLLAPSE_KEY = "live-activity-pill:collapsed";

/**
 * Dynamic-Island-style minimized state for the active walk. Mounted once at
 * the root. Slides in below the status bar whenever a walk is in progress and
 * the user is anywhere except the active walk surface itself. Tap returns to
 * the full walk screen. Swipe up collapses to a tiny bean; tap re-expands.
 */
export function LiveActivityPill() {
  const { user } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [active, setActive] = useState<ActiveWalk | null>(null);
  const [elapsed, setElapsed] = useState("0:00");
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(COLLAPSE_KEY) === "1";
  });

  // Source of truth: an active walk_session for this user (the same data the
  // active-walk page uses). Pod info is layered on if present.
  useEffect(() => {
    if (!user) { setActive(null); return; }
    let cancelled = false;

    const load = async () => {
      const { data: w } = await supabase
        .from("walk_sessions")
        .select("id, started_at, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (!w) { setActive(null); return; }

      const { data: p } = await supabase
        .from("audio_room_participants")
        .select("audio_rooms(title, current_participant_count, status)")
        .eq("user_id", user.id)
        .eq("walk_session_id", w.id)
        .eq("status", "active")
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const room = (p as any)?.audio_rooms;
      const inOpenRoom = room && room.status === "open";
      setActive({
        walkId: w.id,
        startedAt: new Date(w.started_at ?? Date.now()).getTime(),
        roomTitle: inOpenRoom ? (room.title ?? "Walk & Talk") : null,
        participantCount: inOpenRoom ? (room.current_participant_count ?? 1) : null,
      });
    };

    load();
    const ch = supabase
      .channel(`live-activity-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "walk_sessions", filter: `user_id=eq.${user.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "audio_room_participants", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    const t = window.setInterval(load, 30_000);
    return () => { cancelled = true; supabase.removeChannel(ch); clearInterval(t); };
  }, [user]);

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const s = Math.max(0, Math.floor((Date.now() - active.startedAt) / 1000));
      const m = Math.floor(s / 60), sec = s % 60;
      setElapsed(`${m}:${sec.toString().padStart(2, "0")}`);
    };
    tick();
    const i = window.setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [active]);

  // Swipe handling
  const touchStartY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    if (dy > 24) setAndPersist(true);
    else if (dy < -24) setAndPersist(false);
    touchStartY.current = null;
  };
  const setAndPersist = (v: boolean) => {
    setCollapsed(v);
    try { sessionStorage.setItem(COLLAPSE_KEY, v ? "1" : "0"); } catch { /* noop */ }
  };

  if (!active || !user || path.startsWith("/walk/active/")) return null;

  const onTap = () => {
    haptics.tap();
    if (collapsed) { setAndPersist(false); return; }
    navigate({ to: "/walk/active/$id" as never, params: { id: active.walkId } as never });
  };

  const inPod = active.roomTitle !== null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center"
      style={{ top: "calc(env(safe-area-inset-top) + 8px)" }}
    >
      <button
        type="button"
        onClick={onTap}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-label={collapsed ? "Expand active walk" : "Return to active walk"}
        className={`pointer-events-auto group flex items-center gap-2.5 rounded-full border border-forest/30 bg-forest/95 text-cream shadow-elevated backdrop-blur-md transition-all duration-300 ease-out active:scale-[0.97] ${
          collapsed ? "px-3 py-1.5" : "px-4 py-2"
        }`}
        style={{ animation: "live-pill-in 360ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cream/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-cream" />
        </span>

        {collapsed ? (
          <>
            <Footprints className="h-3.5 w-3.5 opacity-90" strokeWidth={2.2} />
            <span className="text-[11px] font-medium tabular-nums">{elapsed}</span>
          </>
        ) : (
          <>
            {inPod ? <Radio className="h-3.5 w-3.5 opacity-90" /> : <Footprints className="h-3.5 w-3.5 opacity-90" strokeWidth={2.2} />}
            <span className="text-[12px] font-medium leading-none">
              {inPod ? "walking · " : "walking · "}
              <span className="tabular-nums">{elapsed}</span>
            </span>
            {inPod && (
              <>
                <span className="h-3 w-px bg-cream/30" />
                <span className="max-w-[10ch] truncate text-[11px] opacity-90">{active.roomTitle}</span>
                <span className="flex items-center gap-0.5 text-[11px] opacity-90">
                  <Users className="h-3 w-3" />
                  <span className="tabular-nums">{active.participantCount}</span>
                </span>
              </>
            )}
            <span className="ml-1 rounded-full bg-cream/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">return</span>
          </>
        )}
      </button>
      <style>{`
        @keyframes live-pill-in {
          from { transform: translateY(-120%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
