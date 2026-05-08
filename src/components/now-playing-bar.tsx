import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Radio, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

interface ActivePresence {
  walkId: string;
  roomTitle: string;
  participantCount: number;
  joinedAt: number;
}

/**
 * Persistent "you're on a Walk & Talk" pill that lets users browse other tabs
 * without losing the call. Reads existing audio_room_participants — no new
 * tables, no shared state. Hidden on the active walk page itself.
 */
export function NowPlayingBar() {
  const { user } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [active, setActive] = useState<ActivePresence | null>(null);
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!user) { setActive(null); return; }
    let cancelled = false;

    const load = async () => {
      const { data: p } = await supabase
        .from("audio_room_participants")
        .select("walk_session_id, joined_at, audio_rooms(title, current_participant_count, status)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const room = (p as any)?.audio_rooms;
      if (!p || !room || room.status !== "open") { setActive(null); return; }
      setActive({
        walkId: p.walk_session_id,
        roomTitle: room.title ?? "Walk & Talk",
        participantCount: room.current_participant_count ?? 1,
        joinedAt: new Date(p.joined_at).getTime(),
      });
    };

    load();
    const ch = supabase
      .channel(`now-playing-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "audio_room_participants", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    const t = window.setInterval(load, 20_000);
    return () => { cancelled = true; supabase.removeChannel(ch); clearInterval(t); };
  }, [user]);

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const s = Math.max(0, Math.floor((Date.now() - active.joinedAt) / 1000));
      const m = Math.floor(s / 60), sec = s % 60;
      setElapsed(`${m}:${sec.toString().padStart(2, "0")}`);
    };
    tick();
    const i = window.setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [active]);

  // Swipe-up to expand details (intention/elapsed); tap still navigates.
  const [expanded, setExpanded] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    if (dy > 28) setExpanded(true);
    else if (dy < -28) setExpanded(false);
    touchStartY.current = null;
  };

  // Hide while user is on the live walk surface (the dock is right there)
  if (!active || path.startsWith("/walk/active/")) return null;

  return (
    <Link
      to={"/walk/active/$id" as never}
      params={{ id: active.walkId } as never}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="mx-auto -mt-5 mb-3 block rounded-2xl border border-forest/30 glass-dark px-4 py-2.5 text-primary-foreground shadow-soft transition active:scale-[0.99] active:opacity-90 md:-mt-6"
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cream/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-cream" />
        </span>
        <Radio className="h-3.5 w-3.5 shrink-0 opacity-80" />
        <div className="min-w-0 flex-1 text-xs leading-tight">
          <div className="truncate font-medium">{active.roomTitle}</div>
          <div className="flex items-center gap-1.5 opacity-80">
            <Users className="h-2.5 w-2.5" />
            <span className="tabular-nums">{active.participantCount}</span>
            <span>·</span>
            <span className="tabular-nums">{elapsed}</span>
          </div>
        </div>
        <span className="rounded-full bg-cream/15 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider">tap to return</span>
      </div>
      <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${expanded ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <p className="font-serif text-xs italic opacity-90">
            Walk in progress · {elapsed} on your feet. Tap to return, swipe down to dismiss.
          </p>
        </div>
      </div>
      <div aria-hidden className="mx-auto mt-1 h-0.5 w-8 rounded-full bg-cream/40 md:hidden" />
    </Link>
  );
}
