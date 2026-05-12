import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Radio, Users, Footprints, ChevronUp, Square } from "lucide-react";
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
const MAX_WALK_MS = 6 * 60 * 60 * 1000; // 6h hard ceiling
const ENDED_EVENT = "mhwc:walk-ended";

/**
 * Bottom-anchored "Dynamic Island" for the active walk. Mounted once at the
 * root. Sits above the MobileTabBar (never under it). Hidden on
 * /walk/active/* and /journal (the journal page is the post-walk destination
 * — if the user landed there the walk is done from a UX standpoint).
 *
 * Reliability: lazy realtime subscription (only after we confirm an active
 * walk exists), local 'mhwc:walk-ended' window event for instant dismissal,
 * 6h hard ceiling, refetch on focus. No polling.
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
  const dismissedIds = useRef<Set<string>>(new Set());
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (!user || inFlight.current) return;
    inFlight.current = true;
    try {
      const { data: w } = await supabase
        .from("walk_sessions")
        .select("id, started_at, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!w || dismissedIds.current.has(w.id)) {
        setActive(null);
        return;
      }
      const startedAt = new Date(w.started_at ?? Date.now()).getTime();
      // 6h hard ceiling — abandon orphan walks (force-closed tab, etc.)
      if (Date.now() - startedAt > MAX_WALK_MS) {
        dismissedIds.current.add(w.id);
        await supabase
          .from("walk_sessions")
          .update({ status: "abandoned", ended_at: new Date().toISOString() })
          .eq("id", w.id)
          .eq("status", "active");
        setActive(null);
        return;
      }
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
        startedAt,
        roomTitle: inOpenRoom ? room.title ?? "Walk & Talk" : null,
        participantCount: inOpenRoom ? room.current_participant_count ?? 1 : null,
      });
    } finally {
      inFlight.current = false;
    }
  }, [user]);

  // Initial load + focus refetch. No polling.
  useEffect(() => {
    if (!user) {
      setActive(null);
      return;
    }
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user, load]);

  // Lazy realtime: only subscribe once we know the user has an active walk.
  // Cuts steady-state channel count to ~currently-walking users.
  useEffect(() => {
    if (!user || !active) return;
    const ch = supabase
      .channel(`live-walk-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "walk_sessions", filter: `user_id=eq.${user.id}` },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "audio_room_participants", filter: `user_id=eq.${user.id}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, active, load]);

  // Local broadcast: active walk page fires `mhwc:walk-ended` so we never wait
  // on realtime to dismiss.
  useEffect(() => {
    const onEnded = (e: Event) => {
      const id = (e as CustomEvent<{ walkId?: string }>).detail?.walkId;
      if (id) dismissedIds.current.add(id);
      setActive(null);
    };
    window.addEventListener(ENDED_EVENT, onEnded as EventListener);
    return () => window.removeEventListener(ENDED_EVENT, onEnded as EventListener);
  }, []);

  // Tick elapsed
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const s = Math.max(0, Math.floor((Date.now() - active.startedAt) / 1000));
      const m = Math.floor(s / 60),
        sec = s % 60;
      setElapsed(`${m}:${sec.toString().padStart(2, "0")}`);
    };
    tick();
    const i = window.setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [active]);

  // Swipe handling (down = collapse, up = expand)
  const touchStartY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    if (dy < -24) setAndPersist(true);
    else if (dy > 24) setAndPersist(false);
    touchStartY.current = null;
  };
  const setAndPersist = (v: boolean) => {
    setCollapsed(v);
    try {
      sessionStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
    } catch {
      /* noop */
    }
  };

  const onActiveWalkRoute = path.startsWith("/walk/active/");
  // After end-walk we route to /journal — never show the pill there.
  const onJournal = path.startsWith("/journal");

  if (!active || !user || onActiveWalkRoute || onJournal) return null;

  const goReturn = () => {
    haptics.tap();
    if (collapsed) {
      setAndPersist(false);
      return;
    }
    navigate({ to: "/walk/active/$id" as never, params: { id: active.walkId } as never });
  };

  const inPod = active.roomTitle !== null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3 md:left-60 md:px-6"
      style={{
        bottom: "calc(var(--tabbar-h, 0px) + env(safe-area-inset-bottom) + 10px)",
      }}
    >
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={`pointer-events-auto w-full max-w-md overflow-hidden rounded-3xl border border-forest/40 bg-forest/95 text-cream shadow-elevated backdrop-blur-md transition-all duration-300 ease-out ${
          collapsed ? "max-h-12" : "max-h-40"
        }`}
        style={{ animation: "live-pill-in 360ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={goReturn}
            aria-label="Expand active walk"
            className="flex w-full items-center justify-between gap-2 px-4 py-2.5"
          >
            <span className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cream/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cream" />
              </span>
              <Footprints className="h-3.5 w-3.5" strokeWidth={2.2} />
              <span className="text-[12px] font-medium tabular-nums">{elapsed}</span>
            </span>
            <ChevronUp className="h-4 w-4 opacity-80" />
          </button>
        ) : (
          <div className="flex flex-col gap-2 px-4 py-3">
            {/* Title row */}
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cream/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cream" />
              </span>
              {inPod ? (
                <Radio className="h-4 w-4 opacity-90" />
              ) : (
                <Footprints className="h-4 w-4 opacity-90" strokeWidth={2.2} />
              )}
              <span className="text-[13px] font-medium leading-none tabular-nums">{elapsed}</span>
              {inPod && (
                <>
                  <span className="h-3 w-px bg-cream/30" />
                  <span className="min-w-0 flex-1 truncate text-[12px] opacity-90">{active.roomTitle}</span>
                  <span className="flex items-center gap-0.5 text-[11px] opacity-90">
                    <Users className="h-3 w-3" />
                    <span className="tabular-nums">{active.participantCount}</span>
                  </span>
                </>
              )}
              {!inPod && <span className="flex-1 text-[12px] opacity-80">walk in progress</span>}
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goReturn}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-cream/15 px-3 py-2 text-[12px] font-medium transition active:scale-[0.97]"
              >
                <Footprints className="h-3.5 w-3.5" strokeWidth={2.2} />
                Return to walk
              </button>
              <button
                type="button"
                onClick={() => {
                  haptics.tap();
                  navigate({
                    to: "/walk/active/$id" as never,
                    params: { id: active.walkId } as never,
                    search: { end: 1 } as never,
                  });
                }}
                className="flex items-center justify-center gap-1.5 rounded-full border border-cream/30 bg-transparent px-3 py-2 text-[12px] font-medium opacity-90 transition active:scale-[0.97]"
                aria-label="End walk"
              >
                <Square className="h-3.5 w-3.5" />
                End
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes live-pill-in {
          from { transform: translateY(120%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
