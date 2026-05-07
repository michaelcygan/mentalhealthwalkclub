import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic, MicOff, LogOut, Loader2, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAudioRoom } from "@/lib/audio/use-audio-room";
import { joinAudioRoom, leaveAudioRoom, matchOrCreateAudioRoom } from "@/server/audio.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AmbientPad, playJoinChime } from "@/lib/audio/ambient-pad";
import { toast } from "sonner";

interface Props {
  walkSessionId: string;
  mood: string | null;
  hasMoved: boolean;
}

const MATCH_PHRASES = [
  "listening for walkers near you…",
  "tuning the room…",
  "almost there…",
];

export function WalkTalkDock({ walkSessionId, mood, hasMoved }: Props) {
  const { user } = useAuth();
  const matchFn = useServerFn(matchOrCreateAudioRoom);
  const joinFn = useServerFn(joinAudioRoom);
  const leaveFn = useServerFn(leaveAudioRoom);

  const [phase, setPhase] = useState<"waiting-to-walk" | "matching" | "in-room" | "left">("waiting-to-walk");
  const [room, setRoom] = useState<{ id: string; title: string; capacity: number } | null>(null);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [profiles, setProfiles] = useState<Record<string, { display_name: string | null; avatar_url: string | null }>>({});
  const padRef = useRef<AmbientPad | null>(null);
  const aloneTimerRef = useRef<number | null>(null);
  const padStartedRef = useRef(false);

  // Auto-match once user is moving
  useEffect(() => {
    if (!hasMoved || phase !== "waiting-to-walk") return;
    setPhase("matching");
    matchFn({ data: { walkSessionId, mood: mood ?? null } })
      .then(async (r) => {
        await joinFn({ data: { roomId: r.roomId, walkSessionId } });
        setRoom({ id: r.roomId, title: r.title, capacity: r.capacity });
        setPhase("in-room");
        try { playJoinChime(); } catch { /* noop */ }
      })
      .catch((e: Error) => {
        toast.error(e.message);
        setPhase("waiting-to-walk");
      });
  }, [hasMoved, phase, walkSessionId, mood, matchFn, joinFn]);

  // Cycle matching phrases
  useEffect(() => {
    if (phase !== "matching") return;
    const t = setInterval(() => setPhraseIdx((i) => (i + 1) % MATCH_PHRASES.length), 2200);
    return () => clearInterval(t);
  }, [phase]);

  const { participants, status, muted, toggleMute, leave } = useAudioRoom(
    phase === "in-room" ? room?.id ?? null : null,
    user?.id ?? null,
    phase === "in-room",
  );

  // Fetch profiles
  const ids = useMemo(() => participants.map((p) => p.userId), [participants]);
  useEffect(() => {
    const missing = ids.filter((id) => !profiles[id]);
    if (missing.length === 0) return;
    supabase.from("profiles").select("id,display_name,avatar_url").in("id", missing).then(({ data }) => {
      if (!data) return;
      setProfiles((prev) => {
        const next = { ...prev };
        for (const p of data) next[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
        return next;
      });
    });
  }, [ids, profiles]);

  const others = participants.filter((p) => p.userId !== user?.id);
  const alone = phase === "in-room" && others.length === 0;

  // Ambient pad: start after 60s alone, duck when others join, swell when alone again
  useEffect(() => {
    if (phase !== "in-room") return;
    if (alone) {
      if (aloneTimerRef.current) window.clearTimeout(aloneTimerRef.current);
      aloneTimerRef.current = window.setTimeout(async () => {
        if (!padRef.current) padRef.current = new AmbientPad();
        await padRef.current.start(0.18);
        padStartedRef.current = true;
      }, 60_000);
    } else {
      if (aloneTimerRef.current) { window.clearTimeout(aloneTimerRef.current); aloneTimerRef.current = null; }
      if (padStartedRef.current) {
        padRef.current?.duck(0.04);
        try { playJoinChime(); } catch { /* noop */ }
      }
    }
    return () => { if (aloneTimerRef.current) window.clearTimeout(aloneTimerRef.current); };
  }, [alone, phase]);

  // Cleanup pad on unmount / leave
  useEffect(() => {
    return () => { padRef.current?.stop(); padRef.current = null; padStartedRef.current = false; };
  }, []);

  const handleLeave = async () => {
    await padRef.current?.stop();
    padRef.current = null;
    padStartedRef.current = false;
    await leave();
    if (room) await leaveFn({ data: { roomId: room.id } }).catch(() => {});
    setRoom(null);
    setPhase("left");
    toast.success("Left the room. Your walk continues.");
  };

  const handleSkip = async () => {
    if (!room) return;
    await padRef.current?.stop();
    padRef.current = null;
    padStartedRef.current = false;
    await leave();
    await leaveFn({ data: { roomId: room.id } }).catch(() => {});
    setRoom(null);
    setProfiles({});
    setPhase("matching");
    matchFn({ data: { walkSessionId, mood: mood ?? null } })
      .then(async (r) => {
        await joinFn({ data: { roomId: r.roomId, walkSessionId } });
        setRoom({ id: r.roomId, title: r.title, capacity: r.capacity });
        setPhase("in-room");
        try { playJoinChime(); } catch { /* noop */ }
      })
      .catch((e: Error) => { toast.error(e.message); setPhase("left"); });
  };

  // ── UI ───────────────────────────────────────────────────────────

  if (phase === "left") {
    return (
      <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-soft">
        <p className="font-serif text-lg">Walking on your own.</p>
        <p className="mt-1 text-sm text-muted-foreground">A room is always one tap away.</p>
        <Button onClick={() => setPhase("waiting-to-walk")} className="mt-4 rounded-full bg-forest text-primary-foreground hover:opacity-90">
          Re-join Walk &amp; Talk
        </Button>
      </div>
    );
  }

  if (phase === "waiting-to-walk") {
    return (
      <div className="overflow-hidden rounded-3xl border border-forest/20 bg-gradient-to-br from-accent/40 via-card to-card p-7 text-center shadow-soft">
        <div className="mx-auto h-2 w-2 animate-pulse rounded-full bg-forest" />
        <p className="mt-4 font-serif text-xl">A room is waiting.</p>
        <p className="mt-1 text-sm text-muted-foreground">Take a few steps. We'll fade you in.</p>
      </div>
    );
  }

  if (phase === "matching") {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-forest/20 via-accent/40 to-cream p-10 text-center shadow-elevated">
        <div className="absolute inset-0 -z-10 opacity-60" style={{ animation: "padBreath 6s ease-in-out infinite" }} />
        <div className="mx-auto flex h-16 w-16 items-center justify-center">
          <span className="absolute h-16 w-16 animate-ping rounded-full bg-forest/30" />
          <span className="relative h-3 w-3 rounded-full bg-forest" />
        </div>
        <p key={phraseIdx} className="mt-6 animate-in fade-in font-serif text-base italic text-foreground/80 duration-700">
          {MATCH_PHRASES[phraseIdx]}
        </p>
        <style>{`@keyframes padBreath { 0%,100% { transform: scale(1); opacity: .5 } 50% { transform: scale(1.05); opacity: .8 } }`}</style>
      </div>
    );
  }

  // in-room
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card/90 p-5 shadow-elevated backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-forest">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-forest" />
            </span>
            Walk &amp; Talk · live
          </div>
          <div className="mt-0.5 font-serif text-lg leading-tight">{room?.title}</div>
          <div className="text-xs text-muted-foreground">
            {status === "connecting" || status === "requesting-mic" ? "connecting…" : alone ? "you're the first one here" : `${participants.length} walking together`}
          </div>
        </div>
        <button onClick={handleSkip} className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-forest/40 hover:text-foreground">
          <Sparkles className="h-3 w-3" /> Skip
        </button>
      </div>

      <ul className="mb-5 flex flex-wrap items-center gap-3">
        {participants.map((p) => {
          const profile = profiles[p.userId];
          const name = profile?.display_name ?? (p.userId === user?.id ? "you" : "walker");
          const initial = (name?.[0] ?? "•").toUpperCase();
          return (
            <li key={p.userId} className="flex flex-col items-center gap-1.5">
              <div className={`relative grid h-12 w-12 place-items-center rounded-full border bg-secondary text-sm font-medium transition-transform ${p.speaking ? "scale-105 ring-2 ring-forest ring-offset-2 ring-offset-card" : ""}`}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                ) : <span>{initial}</span>}
                {p.muted && (
                  <div className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-muted-foreground text-background">
                    <MicOff className="h-3 w-3" />
                  </div>
                )}
              </div>
              <div className="max-w-[64px] truncate text-[11px] text-muted-foreground">{name}</div>
            </li>
          );
        })}
        {alone && (
          <li className="relative flex h-12 w-12 items-center justify-center">
            <span className="absolute h-12 w-12 rounded-full border border-forest/30" style={{ animation: "ripple 3s ease-out infinite" }} />
            <span className="absolute h-12 w-12 rounded-full border border-forest/20" style={{ animation: "ripple 3s ease-out 1.5s infinite" }} />
            <Users className="h-4 w-4 text-forest/50" />
            <style>{`@keyframes ripple { 0% { transform: scale(.6); opacity: .9 } 100% { transform: scale(1.6); opacity: 0 } }`}</style>
          </li>
        )}
      </ul>

      {alone && (
        <p className="mb-4 text-center font-serif text-xs italic text-muted-foreground">
          Someone will join. The air will hold the room.
        </p>
      )}

      <div className="flex gap-3">
        <Button onClick={toggleMute} variant={muted ? "outline" : "default"} className={`h-12 flex-1 rounded-2xl ${muted ? "" : "bg-forest text-primary-foreground hover:opacity-90"}`}>
          {muted ? <><MicOff className="mr-2 h-4 w-4" />Unmute</> : <><Mic className="mr-2 h-4 w-4" />Mute</>}
        </Button>
        <Button onClick={handleLeave} variant="outline" className="h-12 flex-1 rounded-2xl">
          <LogOut className="mr-2 h-4 w-4" />Leave room
        </Button>
      </div>

      {(status === "connecting" || status === "requesting-mic") && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> connecting your mic…
        </p>
      )}
    </div>
  );
}
