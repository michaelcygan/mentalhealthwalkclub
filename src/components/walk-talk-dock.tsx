import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic, MicOff, LogOut, Loader2, Sparkles, Users, Hand, Music, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAudioRoom } from "@/lib/audio/use-audio-room";
import { joinAudioRoom, leaveAudioRoom, matchOrCreateAudioRoom } from "@/server/audio.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AmbientPad, playJoinChime, timeOfDayKey } from "@/lib/audio/ambient-pad";
import { toast } from "sonner";
import { ReflectionDrift } from "@/components/reflection-drift";

interface Props {
  walkSessionId: string;
  mood: string | null;
  hasMoved: boolean;
  onSavePrompt?: (text: string) => void;
}

const MATCH_PHRASES = [
  "listening for walkers near you…",
  "tuning the walk…",
  "almost there…",
];

const HF_KEY = "walkAndTalk.handsFree";
const QUIET_KEY = "walkAndTalk.preferQuiet";

function buzz(pattern: number | number[]) {
  try { (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate?.(pattern); } catch { /* noop */ }
}

export function WalkTalkDock({ walkSessionId, mood, hasMoved, onSavePrompt }: Props) {
  const { user } = useAuth();
  const matchFn = useServerFn(matchOrCreateAudioRoom);
  const joinFn = useServerFn(joinAudioRoom);
  const leaveFn = useServerFn(leaveAudioRoom);

  const [phase, setPhase] = useState<"waiting-to-walk" | "matching" | "in-room" | "left" | "retry">("waiting-to-walk");
  const [room, setRoom] = useState<{ id: string; title: string; capacity: number } | null>(null);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [profiles, setProfiles] = useState<Record<string, { display_name: string | null; avatar_url: string | null }>>({});
  const [handsFree, setHandsFree] = useState(false);
  const [preferQuiet, setPreferQuiet] = useState(false);
  const [showSilenceChoice, setShowSilenceChoice] = useState(false);
  const padRef = useRef<AmbientPad | null>(null);
  const aloneTimerRef = useRef<number | null>(null);
  const silenceChoiceTimerRef = useRef<number | null>(null);
  const padStartedRef = useRef(false);
  const lastParticipantCountRef = useRef(0);
  const retryAttemptRef = useRef(0);

  // Read persisted preferences
  useEffect(() => {
    try {
      setHandsFree(localStorage.getItem(HF_KEY) === "1");
      setPreferQuiet(localStorage.getItem(QUIET_KEY) === "1");
    } catch { /* noop */ }
  }, []);

  const persist = (k: string, v: boolean) => { try { localStorage.setItem(k, v ? "1" : "0"); } catch { /* noop */ } };

  const runMatch = useCallback(async () => {
    setPhase("matching");
    const tryOnce = async (attempt: number): Promise<void> => {
      try {
        const r = await matchFn({ data: { walkSessionId, mood: mood ?? null } });
        await joinFn({ data: { roomId: r.roomId, walkSessionId } });
        setRoom({ id: r.roomId, title: r.title, capacity: r.capacity });
        setPhase("in-room");
        retryAttemptRef.current = 0;
        try { playJoinChime(); buzz(8); } catch { /* noop */ }
      } catch (e) {
        if (attempt >= 3) { retryAttemptRef.current = attempt; setPhase("retry"); toast.error((e as Error).message); return; }
        const delay = [1000, 3000, 8000][attempt] ?? 8000;
        await new Promise((res) => setTimeout(res, delay));
        return tryOnce(attempt + 1);
      }
    };
    await tryOnce(0);
  }, [matchFn, joinFn, walkSessionId, mood]);

  // Auto-match once user is moving
  useEffect(() => {
    if (!hasMoved || phase !== "waiting-to-walk") return;
    runMatch();
  }, [hasMoved, phase, runMatch]);

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

  // Initial mute when hands-free is OFF (push-to-talk)
  useEffect(() => {
    if (phase === "in-room" && !handsFree && !muted) toggleMute();
    // intentionally only on phase change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

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

  // Chime + buzz on every arrival (not just first)
  useEffect(() => {
    if (phase !== "in-room") return;
    const now = participants.length;
    const prev = lastParticipantCountRef.current;
    if (now > prev && prev > 0) {
      try { playJoinChime(); buzz([6, 40, 6]); } catch { /* noop */ }
    }
    lastParticipantCountRef.current = now;
  }, [participants.length, phase]);

  // Alone choreography: silence choice at 30s, ambient pad at 60s (unless quiet preferred)
  useEffect(() => {
    if (phase !== "in-room") return;
    const clearTimers = () => {
      if (aloneTimerRef.current) { window.clearTimeout(aloneTimerRef.current); aloneTimerRef.current = null; }
      if (silenceChoiceTimerRef.current) { window.clearTimeout(silenceChoiceTimerRef.current); silenceChoiceTimerRef.current = null; }
    };

    if (alone) {
      silenceChoiceTimerRef.current = window.setTimeout(() => setShowSilenceChoice(true), 30_000);
      if (!preferQuiet) {
        aloneTimerRef.current = window.setTimeout(async () => {
          if (!padRef.current) padRef.current = new AmbientPad();
          await padRef.current.start(0.18, timeOfDayKey());
          padStartedRef.current = true;
        }, 60_000);
      }
    } else {
      setShowSilenceChoice(false);
      clearTimers();
      if (padStartedRef.current) padRef.current?.duck(0.04);
    }
    return clearTimers;
  }, [alone, phase, preferQuiet]);

  // Visibility-aware pad ducking (battery friendly when phone in pocket)
  useEffect(() => {
    if (phase !== "in-room") return;
    const onVis = () => {
      if (!padStartedRef.current) return;
      if (document.hidden) padRef.current?.duck(0.02);
      else if (alone) padRef.current?.swell(0.18);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [phase, alone]);

  // Media Session — lock-screen + Bluetooth controls
  useEffect(() => {
    if (phase !== "in-room" || !room) return;
    const ms = (navigator as Navigator & { mediaSession?: MediaSession }).mediaSession;
    if (!ms) return;
    try {
      ms.metadata = new MediaMetadata({ title: room.title, artist: "Walk & Talk", album: "Walk Club" });
      ms.setActionHandler("play", () => { if (muted) toggleMute(); });
      ms.setActionHandler("pause", () => { if (!muted) toggleMute(); });
    } catch { /* noop */ }
    return () => { try { ms.setActionHandler("play", null); ms.setActionHandler("pause", null); } catch { /* noop */ } };
  }, [phase, room, muted, toggleMute]);

  // Cleanup pad on unmount
  useEffect(() => () => { padRef.current?.stop(); padRef.current = null; padStartedRef.current = false; }, []);

  const handleLeave = async () => {
    await padRef.current?.stop();
    padRef.current = null;
    padStartedRef.current = false;
    await leave();
    if (room) await leaveFn({ data: { roomId: room.id } }).catch(() => {});
    setRoom(null);
    setPhase("left");
    toast.success("Left the walk. Your steps continue.");
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
    lastParticipantCountRef.current = 0;
    runMatch();
  };

  // Push-to-talk handlers (when hands-free is OFF)
  const ptt = (active: boolean) => {
    if (handsFree) return;
    if (active && muted) { toggleMute(); buzz(6); }
    else if (!active && !muted) { toggleMute(); }
  };

  const toggleHandsFree = () => {
    const next = !handsFree;
    setHandsFree(next);
    persist(HF_KEY, next);
    if (!next && !muted) toggleMute(); // entering PTT mode → mute
    if (next && muted) toggleMute();    // entering hands-free → unmute
  };

  const chooseQuiet = () => {
    setPreferQuiet(true); persist(QUIET_KEY, true);
    setShowSilenceChoice(false);
    if (aloneTimerRef.current) window.clearTimeout(aloneTimerRef.current);
    toast("Holding the silence with you.");
  };
  const chooseMusic = async () => {
    setPreferQuiet(false); persist(QUIET_KEY, false);
    setShowSilenceChoice(false);
    if (!padRef.current) padRef.current = new AmbientPad();
    await padRef.current.start(0.18, timeOfDayKey());
    padStartedRef.current = true;
  };

  // ── UI ───────────────────────────────────────────────────────────

  if (phase === "left") {
    return (
      <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-soft">
        <p className="font-serif text-lg">Walking on your own.</p>
        <p className="mt-1 text-sm text-muted-foreground">A walk is always one tap away.</p>
        <Button onClick={() => setPhase("waiting-to-walk")} className="mt-4 rounded-full bg-forest text-primary-foreground hover:opacity-90">
          Re-join Walk &amp; Talk
        </Button>
      </div>
    );
  }

  if (phase === "retry") {
    return (
      <div className="rounded-3xl border border-clay/40 bg-card p-6 text-center shadow-soft">
        <p className="font-serif text-lg">Couldn't find a walk.</p>
        <p className="mt-1 text-sm text-muted-foreground">The signal's quiet right now.</p>
        <Button onClick={() => runMatch()} className="mt-4 rounded-full bg-forest text-primary-foreground hover:opacity-90">
          Try again
        </Button>
      </div>
    );
  }

  if (phase === "waiting-to-walk") {
    return (
      <div className="overflow-hidden rounded-3xl border border-forest/20 bg-gradient-to-br from-accent/40 via-card to-card p-7 text-center shadow-soft">
        <div className="mx-auto h-2 w-2 animate-pulse rounded-full bg-forest" />
        <p className="mt-4 font-serif text-xl">A room is waiting.</p>
        <p className="mt-1 text-sm text-muted-foreground">Take a few steps and we'll fade you in — or use "I'm walking" above if your phone can't see GPS.</p>
      </div>
    );
  }

  if (phase === "matching") {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-forest/20 via-accent/40 to-cream p-10 text-center shadow-elevated">
        <div className="mx-auto flex h-16 w-16 items-center justify-center">
          <span className="absolute h-16 w-16 animate-ping rounded-full bg-forest/30" />
          <span className="relative h-3 w-3 rounded-full bg-forest" />
        </div>
        <p key={phraseIdx} className="mt-6 animate-in fade-in font-serif text-base italic text-foreground/80 duration-700">
          {MATCH_PHRASES[phraseIdx]}
        </p>
      </div>
    );
  }

  // ── in-room ─────────────────────────────────────────────────────
  // Avatar constellation: arrange around a center circle
  const radius = 70;
  const positioned = participants.map((p, i, arr) => {
    const angle = arr.length === 1 ? -Math.PI / 2 : (i / arr.length) * Math.PI * 2 - Math.PI / 2;
    return { ...p, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });

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

      {/* Constellation — full size when others present, compact badge when alone */}
      {!alone ? (
        <div className="relative mx-auto mb-5 grid h-44 w-44 place-items-center">
          {positioned.map((p) => {
            const profile = profiles[p.userId];
            const name = profile?.display_name ?? (p.userId === user?.id ? "you" : "walker");
            const initial = (name?.[0] ?? "•").toUpperCase();
            return (
              <div
                key={p.userId}
                className="absolute flex flex-col items-center gap-1 transition-transform duration-700 animate-in fade-in zoom-in"
                style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
              >
                <div className={`relative grid h-14 w-14 place-items-center rounded-full border bg-secondary text-sm font-medium transition ${p.speaking ? "scale-110 ring-2 ring-forest ring-offset-2 ring-offset-card" : ""}`}>
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : <span>{initial}</span>}
                  {p.muted && (
                    <div className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-muted-foreground text-background">
                      <MicOff className="h-3 w-3" />
                    </div>
                  )}
                </div>
                <div className="max-w-[70px] truncate text-[10px] text-muted-foreground">{name}</div>
              </div>
            );
          })}
          <style>{`@keyframes ripple { 0% { transform: scale(.5); opacity: .9 } 100% { transform: scale(1.4); opacity: 0 } }`}</style>
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="relative grid h-7 w-7 place-items-center rounded-full border border-forest/20 bg-secondary">
            <Users className="h-3.5 w-3.5 text-forest/60" />
            <span className="absolute inset-0 rounded-full border border-forest/20" style={{ animation: "ripple 3s ease-out infinite" }} />
          </span>
          <span className="font-serif italic">holding the room — someone may join</span>
          <style>{`@keyframes ripple { 0% { transform: scale(.85); opacity: .9 } 100% { transform: scale(1.5); opacity: 0 } }`}</style>
        </div>
      )}

      {alone && !showSilenceChoice && (
        <ReflectionDrift
          mood={mood}
          intervalMs={preferQuiet ? 18_000 : 24_000}
          onSavePrompt={onSavePrompt}
          className="mb-4"
        />
      )}

      {showSilenceChoice && alone && (
        <div className="mb-4 animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-border bg-secondary/60 p-3 text-center">
          <p className="mb-2 font-serif text-sm italic">Want company or quiet?</p>
          <div className="flex gap-2">
            <button onClick={chooseQuiet} className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs hover:border-forest/40">
              <Wind className="h-3.5 w-3.5" /> Quiet
            </button>
            <button onClick={chooseMusic} className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs hover:border-forest/40">
              <Music className="h-3.5 w-3.5" /> Music
            </button>
          </div>
        </div>
      )}

      {/* Cockpit */}
      <div className="space-y-3">
        {handsFree ? (
          <Button onClick={toggleMute} variant={muted ? "outline" : "default"} className={`h-14 w-full rounded-2xl touch-manipulation ${muted ? "" : "bg-forest text-primary-foreground hover:opacity-90"}`}>
            {muted ? <><MicOff className="mr-2 h-4 w-4" />Unmute</> : <><Mic className="mr-2 h-4 w-4" />Mute</>}
          </Button>
        ) : (
          <button
            onPointerDown={() => ptt(true)}
            onPointerUp={() => ptt(false)}
            onPointerLeave={() => ptt(false)}
            onPointerCancel={() => ptt(false)}
            className={`flex h-16 w-full select-none items-center justify-center gap-2 rounded-2xl border text-sm font-medium transition touch-manipulation ${
              !muted ? "border-forest bg-forest text-primary-foreground scale-[0.98] shadow-elevated" : "border-border bg-card text-foreground active:bg-secondary"
            }`}
          >
            <Hand className="h-4 w-4" />
            {!muted ? "Speaking…" : "Hold to talk"}
          </button>
        )}

        <div className="flex items-center justify-between gap-3">
          <button onClick={toggleHandsFree} className="text-[11px] text-muted-foreground underline-offset-4 hover:underline">
            {handsFree ? "Switch to push-to-talk" : "Switch to hands-free"}
          </button>
          <button onClick={handleLeave} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-clay/40 hover:text-foreground">
            <LogOut className="h-3 w-3" />Leave room
          </button>
        </div>
      </div>

      {(status === "connecting" || status === "requesting-mic") && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> connecting your mic…
        </p>
      )}
    </div>
  );
}
