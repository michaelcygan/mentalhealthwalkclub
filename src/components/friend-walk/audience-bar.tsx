import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Headphones } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sendReaction, audienceHeartbeat } from "@/lib/friend-walk.functions";
import { getGuestId } from "@/lib/guest-id";
import { useAuth } from "@/lib/auth-context";
import { haptics } from "@/lib/device";

const REACTIONS: Array<{ kind: "heart" | "clap" | "leaf" | "fire" | "tear"; emoji: string }> = [
  { kind: "heart", emoji: "💚" },
  { kind: "clap", emoji: "👏" },
  { kind: "leaf", emoji: "🌿" },
  { kind: "fire", emoji: "🔥" },
  { kind: "tear", emoji: "🥹" },
];

interface FloatingReaction { id: string; emoji: string; left: number; }

export function AudienceBar({ roomId, audienceCount: initial, reactionsEnabled = true }: { roomId: string; audienceCount: number; reactionsEnabled?: boolean }) {
  const { user } = useAuth();
  const react = useServerFn(sendReaction);
  const heartbeat = useServerFn(audienceHeartbeat);
  const [count, setCount] = useState(initial);
  const [floats, setFloats] = useState<FloatingReaction[]>([]);
  const guestId = useRef(getGuestId());

  // heartbeat + audience count subscription
  useEffect(() => {
    if (!roomId) return;
    const tick = () => heartbeat({ data: { roomId, guestId: user ? undefined : guestId.current, userId: user?.id } }).catch(() => {});
    tick();
    const i = setInterval(tick, 25_000);
    const ch = supabase
      .channel(`room-pulse-${roomId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "audio_rooms", filter: `id=eq.${roomId}` }, (p) => {
        const r = p.new as { audience_count?: number };
        if (typeof r.audience_count === "number") setCount(r.audience_count);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_reactions", filter: `audio_room_id=eq.${roomId}` }, (p) => {
        const r = p.new as { kind: string };
        const e = REACTIONS.find((x) => x.kind === r.kind)?.emoji ?? "💚";
        const f: FloatingReaction = { id: crypto.randomUUID(), emoji: e, left: Math.random() * 80 + 10 };
        setFloats((cur) => [...cur, f]);
        setTimeout(() => setFloats((cur) => cur.filter((x) => x.id !== f.id)), 2400);
      })
      .subscribe();
    return () => { clearInterval(i); supabase.removeChannel(ch); };
  }, [roomId, user, heartbeat]);

  const onReact = (kind: typeof REACTIONS[number]["kind"]) => {
    if (!reactionsEnabled) return;
    haptics.tap();
    react({ data: { roomId, kind, guestId: user ? undefined : guestId.current, userId: user?.id } }).catch(() => {});
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex flex-col items-center md:bottom-6">
      <div className="pointer-events-none relative h-24 w-full max-w-md">
        {floats.map((f) => (
          <span
            key={f.id}
            className="absolute bottom-0 animate-[float_2.4s_ease-out_forwards] text-2xl"
            style={{ left: `${f.left}%` }}
          >
            {f.emoji}
          </span>
        ))}
      </div>
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-cream/30 bg-forest/85 px-4 py-2 text-cream shadow-elevated backdrop-blur">
        <span className="flex items-center gap-1.5 text-xs">
          <Headphones className="h-3.5 w-3.5" />
          <span className="font-medium tabular-nums">{count}</span>
          <span className="opacity-70">listening</span>
        </span>
        {reactionsEnabled && (
          <div className="flex items-center gap-1">
            {REACTIONS.map((r) => (
              <button
                key={r.kind}
                onClick={() => onReact(r.kind)}
                className="rounded-full px-1.5 py-1 text-lg transition hover:scale-110 active:scale-95"
                aria-label={`react with ${r.kind}`}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        )}
      </div>
      <style>{`
        @keyframes float {
          0% { transform: translateY(0) scale(.8); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(-120px) scale(1.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
