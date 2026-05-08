import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Shield, Pause, Play, Square, AlertTriangle, Footprints, Share2 } from "lucide-react";
import { toast } from "sonner";
import { RouteSparkline } from "@/components/route-sparkline";
import { WalkTalkDock } from "@/components/walk-talk-dock";
import { EndWalkFlow } from "@/components/end-walk-flow";
import { GuidedPlayer } from "@/components/guided-player";
import { ListenerPool } from "@/components/friend-walk/listener-pool";
import { FriendWalkShareCard } from "@/components/friend-walk/share-card";
import { wakeLock, haptics } from "@/lib/device";
import { AmbientPill } from "@/components/ambient-pill";
import { useAmbient } from "@/lib/ambient-context";
import { WalkNotesPill, loadStoredNotes, loadStoredPhotos, notesToJournalBlock, clearWalkCaptures, uploadWalkPhotos, type WalkNote, type WalkPhoto } from "@/components/walk-notes-sheet";

export const Route = createFileRoute("/walk/active/$id")({ component: ActiveWalk });

const PULSE_FEELINGS = ["lighter", "same", "heavier"];

interface Session {
  id: string; walk_type: string; mood_before: string | null; mood_before_score: number | null;
  intention: string | null; started_at: string; status: string; guided_track_id: string | null;
  audio_room_id: string | null;
}
interface FriendRoom { id: string; share_code: string | null; host_user_id: string | null; }

type GpsState = "idle" | "live" | "weak" | "denied";

function ActiveWalk() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/" }); }, [loading, user, navigate]);

  // Keep the screen on while a walk is active
  useEffect(() => {
    let release: (() => void) | undefined;
    wakeLock().then((r) => { release = r; });
    return () => { release?.(); };
  }, []);

  // Dynamic theme-color: tint the iOS/Android status bar to forest while walking
  useEffect(() => {
    if (typeof document === "undefined") return;
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    const prev = meta?.getAttribute("content") ?? null;
    if (meta) meta.setAttribute("content", "#1f3a2c");
    return () => { if (meta && prev !== null) meta.setAttribute("content", prev); };
  }, []);

  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [meters, setMeters] = useState(0);
  const [hasMoved, setHasMoved] = useState(false);
  const [ending, setEnding] = useState(false);
  const [routeTick, setRouteTick] = useState(0);
  const [gps, setGps] = useState<GpsState>("idle");
  const [showManualStart, setShowManualStart] = useState(false);
  const milestonesHit = useRef<Set<string>>(new Set());
  const pulseHit = useRef<Set<number>>(new Set());
  const lastPos = useRef<{lat:number;lng:number;t:number} | null>(null);
  const points = useRef<Array<{lat:number;lng:number;t:number}>>([]);
  const watchId = useRef<number | null>(null);
  const pulseRecord = useRef<{ mood: string; score: number } | null>(null);
  const [savedPrompts, setSavedPrompts] = useState<string[]>([]);
  const [walkNotes, setWalkNotes] = useState<WalkNote[]>(() => loadStoredNotes(id));
  const [walkPhotos, setWalkPhotos] = useState<WalkPhoto[]>(() => loadStoredPhotos(id));
  const handleSavePrompt = (text: string) => {
    setSavedPrompts((arr) => (arr.includes(text) ? arr : [...arr, text]));
    toast(`saved: "${text.length > 40 ? text.slice(0, 40) + "…" : text}"`, { duration: 2000 });
  };

  const [friendRoom, setFriendRoom] = useState<FriendRoom | null>(null);
  const [friendShareOpen, setFriendShareOpen] = useState(false);

  useEffect(() => {
    supabase.from("walk_sessions").select("*").eq("id", id).single().then(async ({ data }) => {
      if (!data) return;
      setSession(data as Session);
      if (data.audio_room_id) {
        const { data: room } = await supabase
          .from("audio_rooms")
          .select("id, share_code, host_user_id, room_type")
          .eq("id", data.audio_room_id)
          .maybeSingle();
        if (room && room.room_type === "friend") setFriendRoom(room);
      }
    });
  }, [id]);

  useEffect(() => {
    if (!session) return;
    const start = new Date(session.started_at).getTime();
    const t = setInterval(() => { if (!paused) setElapsed(Math.floor((Date.now() - start) / 1000)); }, 1000);
    return () => clearInterval(t);
  }, [session, paused]);

  useEffect(() => {
    if (!navigator.geolocation) { setGps("denied"); return; }
    watchId.current = navigator.geolocation.watchPosition((pos) => {
      const acc = pos.coords.accuracy ?? 999;
      // Drop low-confidence fixes that cause Wi-Fi drift on desktop
      if (acc > 30) { setGps((g) => g === "live" ? "live" : "weak"); return; }
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, t: Date.now() };
      if (lastPos.current) {
        const d = haversine(lastPos.current, p);
        // Min 2m delta kills jitter; max 200m kills teleports
        if (d >= 2 && d < 200) {
          setMeters((m) => m + d);
          points.current.push(p);
          setRouteTick((x) => x + 1);
          lastPos.current = p;
          setGps("live");
        }
      } else {
        lastPos.current = p;
        points.current.push(p);
        setGps("live");
      }
    }, (err) => {
      setGps(err.code === err.PERMISSION_DENIED ? "denied" : "weak");
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
    return () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); };
  }, []);

  // Manual "I'm walking" affordance after 25s if we never got a confident fix
  useEffect(() => {
    const t = setTimeout(() => { if (!hasMoved) setShowManualStart(true); }, 25_000);
    return () => clearTimeout(t);
  }, [hasMoved]);

  useEffect(() => { if (meters > 15) setHasMoved(true); }, [meters]);

  // Wake Lock — keep screen alive on audio walks (released on unmount)
  useEffect(() => {
    if (!session || session.walk_type !== "audio") return;
    type WakeLockSentinel = { release: () => Promise<void> };
    let lock: WakeLockSentinel | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> } };
    nav.wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => {});
    return () => { lock?.release().catch(() => {}); };
  }, [session]);

  // Milestone toasts + soft haptic so phones in pockets still register
  useEffect(() => {
    const mins = Math.floor(elapsed / 60);
    const fire = (k: string, msg: string) => {
      if (milestonesHit.current.has(k)) return;
      milestonesHit.current.add(k);
      toast(msg, { duration: 3500 });
      haptics.soft();
    };
    if (mins >= 5) fire("5m", "5 minutes in · let your shoulders drop");
    if (mins >= 10) fire("10m", "10 minutes · this is the hard part");
    if (mins >= 20) fire("20m", "20 minutes · you're doing the thing");
    if (mins >= 30) fire("30m", "30 minutes · take a breath");
    if (meters >= 1609) fire("1mi", "First mile · proud of you");
  }, [elapsed, meters]);

  const recordPulse = (label: string) => {
    const map: Record<string, { mood: string; score: number }> = {
      lighter: { mood: "hopeful", score: Math.min(10, (session?.mood_before_score ?? 5) + 2) },
      same: { mood: session?.mood_before ?? "okay", score: session?.mood_before_score ?? 5 },
      heavier: { mood: "still heavy", score: Math.max(1, (session?.mood_before_score ?? 5) - 1) },
    };
    pulseRecord.current = map[label];
    toast(`Noted · feeling ${label}`);
  };

  // Pulse check-in as a toast every 10 minutes (no longer pushing layout)
  useEffect(() => {
    const mins = Math.floor(elapsed / 60);
    if (mins > 0 && mins % 10 === 0 && elapsed % 60 === 0 && !pulseHit.current.has(mins)) {
      pulseHit.current.add(mins);
      toast.custom((t) => (
        <div className="flex items-center gap-2 rounded-2xl border border-forest/30 bg-card/95 p-3 shadow-elevated backdrop-blur">
          <span className="text-xs font-medium text-forest">Quick check-in</span>
          {PULSE_FEELINGS.map((f) => (
            <button key={f} onClick={() => { recordPulse(f); toast.dismiss(t); }} className="rounded-full border border-border bg-background px-2.5 py-1 text-xs hover:border-forest/40">
              {f}
            </button>
          ))}
        </div>
      ), { duration: 30_000 });
    }
  }, [elapsed]);

  const miles = meters * 0.000621371;
  const stride = 0.78;
  const steps = Math.round(meters / stride);
  const paceMinPerMi = miles > 0.05 ? (elapsed / 60) / miles : 0;
  const cadence = elapsed > 30 && steps > 50 ? Math.round((steps / elapsed) * 60) : 0;

  // Rotating "hero stat" — softly cycles through the four every 5s
  const [statIdx, setStatIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStatIdx((i) => (i + 1) % 4), 5000);
    return () => clearInterval(id);
  }, []);

  // Calm/dim mode: after 60s without interaction, fade non-essential UI to ~35% opacity.
  const [dim, setDim] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const reset = () => { setDim(false); clearTimeout(t); t = setTimeout(() => setDim(true), 60_000); };
    reset();
    const evs: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"];
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => { clearTimeout(t); evs.forEach((e) => window.removeEventListener(e, reset)); };
  }, []);

  // Ambient music: suppress when this walk owns the audio channel (Walk & Talk
  // or guided walks). Stop on unmount so leaving the walk silences the music.
  const ambient = useAmbient();
  useEffect(() => {
    if (!session) return;
    const ownsAudio = session.walk_type === "audio" || !!session.guided_track_id;
    if (ownsAudio) ambient.stop(300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);
  useEffect(() => () => { ambient.stop(800); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const endWalk = async (out: { moodAfter: string; moodAfterScore: number | null; reflection: string }) => {
    if (!user || !session) return;
    const notesBlock = notesToJournalBlock(walkNotes);
    const merged = [out.reflection?.trim(), notesBlock].filter(Boolean).join("\n\n");
    await supabase.from("walk_sessions").update({
      status: "completed",
      ended_at: new Date().toISOString(),
      duration_seconds: elapsed,
      distance_meters: Math.round(meters),
      steps,
      mood_after: out.moodAfter || pulseRecord.current?.mood || null,
      mood_after_score: out.moodAfterScore ?? pulseRecord.current?.score ?? null,
      reflection_note: merged || null,
    }).eq("id", session.id);
    if (points.current.length > 1) {
      await supabase.from("walk_routes").insert({ walk_session_id: session.id, user_id: user.id, points: points.current });
    }
    if (walkPhotos.length > 0) {
      try { await uploadWalkPhotos({ supabase, userId: user.id, walkSessionId: session.id, photos: walkPhotos }); }
      catch { toast.error("Some photos couldn't upload"); }
    }
    clearWalkCaptures(session.id);
    toast.success("You gave yourself movement and air.");
    navigate({ to: "/journal" as never });
  };

  if (!session) return <div className="py-20 text-center font-serif text-muted-foreground">a quiet moment…</div>;

  if (ending) {
    return (
      <EndWalkFlow
        moodBefore={session.mood_before}
        moodBeforeScore={session.mood_before_score}
        elapsed={elapsed}
        miles={miles}
        savedPrompts={savedPrompts}
        onSave={endWalk}
      />
    );
  }

  const isAudio = session.walk_type === "audio";
  const gpsDot = gps === "live" ? "bg-forest" : gps === "weak" ? "bg-amber-400" : gps === "denied" ? "bg-muted-foreground/40" : "bg-muted-foreground/40";
  const gpsLabel = gps === "live" ? "GPS live" : gps === "weak" ? "GPS searching" : gps === "denied" ? "GPS off" : "GPS waking";

  const paceStr = paceMinPerMi > 0 && paceMinPerMi < 60
    ? `${Math.floor(paceMinPerMi)}'${String(Math.round((paceMinPerMi % 1) * 60)).padStart(2, "0")}"`
    : "—";
  const stats = [
    { label: "miles", value: miles.toFixed(2) },
    { label: "steps", value: steps.toLocaleString() },
    { label: "pace", value: paceStr },
    { label: "cadence", value: cadence > 0 ? cadence.toString() : "—" },
  ] as const;
  const heroStat = stats[statIdx];

  return (
    <div className="-mx-4 md:mx-0">
      {/* Hero — full-bleed route ribbon as backdrop */}
      <section className="relative overflow-hidden gradient-forest px-5 pb-8 pt-7 text-primary-foreground md:rounded-3xl md:px-7 md:pt-8 md:shadow-elevated">
        {points.current.length >= 2 && (
          <div className="pointer-events-none absolute inset-0 opacity-25">
            <RouteSparkline points={points.current} key={routeTick} height={260} />
          </div>
        )}

        <div className={`relative flex items-start justify-between gap-2 transition-opacity duration-700 ${dim ? "opacity-40" : "opacity-100"}`}>
          <p className="font-serif text-sm italic opacity-90">{session.intention || (isAudio ? "On your feet." : "Walking alone still counts.")}</p>
          <div className="flex items-center gap-2">
            {friendRoom?.share_code && (
              <button
                onClick={() => setFriendShareOpen(true)}
                className="flex items-center gap-1.5 rounded-full bg-cream/20 px-3 py-1.5 text-xs backdrop-blur transition active:scale-95"
                aria-label="Share friend walk link"
              >
                <Share2 className="h-3.5 w-3.5" /> Invite
              </button>
            )}
            <SafetyButton walkSessionId={session.id} />
          </div>
        </div>

        <div className="relative mt-8 text-center">
          <div aria-live="off" className={`font-serif text-7xl tabular-nums tracking-tight ${paused ? "" : "breathe"}`}>{fmt(elapsed)}</div>
          <div className={`mt-1 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.22em] transition-opacity duration-700 ${dim ? "opacity-40" : "opacity-80"}`}>
            <span>{paused ? "paused" : "elapsed"}</span>
            <span aria-hidden className="opacity-50">·</span>
            <span className="inline-flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${gpsDot} ${gps === "live" ? "animate-pulse" : ""}`} />
              {gpsLabel}
            </span>
          </div>
        </div>

        {showManualStart && !hasMoved && (
          <div className="relative mt-5 flex justify-center">
            <button
              onClick={() => { setHasMoved(true); setShowManualStart(false); toast("On your feet — counting you in."); }}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-4 py-2 text-xs backdrop-blur transition hover:bg-primary-foreground/25"
            >
              <Footprints className="h-3.5 w-3.5" /> I'm walking — start the room
            </button>
          </div>
        )}

        {/* Hero stat dial — one big number, three quiet satellites. Tap or hover to expand all four. */}
        <div className={`group/dial relative mt-7 transition-opacity duration-700 ${dim ? "opacity-50" : "opacity-100"}`}>
          <button
            type="button"
            onClick={() => setStatIdx((i) => (i + 1) % 4)}
            className="block w-full text-center"
            aria-label={`${heroStat.label}: ${heroStat.value} — tap to cycle`}
          >
            <div key={heroStat.label} className="font-serif text-5xl tabular-nums leading-none animate-[fade-in_0.5s_ease-out]">{heroStat.value}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.22em] opacity-75">{heroStat.label}</div>
          </button>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center opacity-60 transition-opacity group-hover/dial:opacity-90">
            {stats.filter((_, i) => i !== statIdx).map((s) => (
              <button key={s.label} type="button" onClick={() => setStatIdx(stats.findIndex((x) => x.label === s.label))} className="rounded-xl px-1 py-1 transition hover:bg-primary-foreground/5">
                <div className="font-serif text-base tabular-nums leading-none">{s.value}</div>
                <div className="mt-1 text-[10px] uppercase tracking-wider opacity-75">{s.label}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="space-y-4 px-4 pt-5 md:px-0">
        {isAudio && (
          <WalkTalkDock walkSessionId={session.id} mood={session.mood_before} hasMoved={hasMoved} onSavePrompt={handleSavePrompt} />
        )}

        {friendRoom && (
          <ListenerPool roomId={friendRoom.id} isHost={friendRoom.host_user_id === user?.id} />
        )}

        {session.walk_type === "guided_solo" && session.guided_track_id && (
          <GuidedPlayer trackId={session.guided_track_id} paused={paused} />
        )}
      </div>

      {friendRoom?.share_code && (
        <FriendWalkShareCard
          open={friendShareOpen}
          onOpenChange={setFriendShareOpen}
          hostName={user?.user_metadata?.display_name || user?.email?.split("@")[0] || "a friend"}
          hostAvatarUrl={user?.user_metadata?.avatar_url ?? null}
          shareCode={friendRoom.share_code}
        />
      )}

      {/* In-walk utility row: private notes + ambient music pill */}
      <div className="flex flex-wrap items-center justify-center gap-2 px-4 pt-4 md:px-0">
        <WalkNotesPill walkSessionId={session.id} elapsed={elapsed} notes={walkNotes} photos={walkPhotos} onChangeNotes={setWalkNotes} onChangePhotos={setWalkPhotos} />
        {!(session.walk_type === "audio" || session.guided_track_id) && (
          <AmbientPill />
        )}
      </div>

      {/* Sticky control dock */}
      <div className="sticky bottom-0 left-0 right-0 z-20 mt-5 border-t border-border glass px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 md:static md:mt-6 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setPaused((p) => !p)} className="h-14 flex-1 rounded-2xl touch-manipulation md:h-12">
            {paused ? <><Play className="mr-2 h-4 w-4" />Resume</> : <><Pause className="mr-2 h-4 w-4" />Pause</>}
          </Button>
          <LongPressEndButton onEnd={() => setEnding(true)} />
        </div>
        <p className="mt-1.5 text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 md:hidden">hold to end</p>
      </div>
    </div>
  );
}

function SafetyButton({ walkSessionId }: { walkSessionId: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-xs backdrop-blur"><Shield className="h-3.5 w-3.5" />Safety</button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader><SheetTitle className="font-serif text-2xl">You are not alone</SheetTitle></SheetHeader>
        <div className="space-y-4 py-4 text-sm">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
            <div className="flex items-center gap-2 font-medium text-destructive"><AlertTriangle className="h-4 w-4" />In immediate danger?</div>
            <p className="mt-1 text-foreground">Call your local emergency services right now.</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="font-medium">Mental health crisis support (US)</div>
            <p className="mt-1 text-muted-foreground">Call or text <a href="tel:988" className="font-medium text-forest underline">988</a> — Suicide & Crisis Lifeline.</p>
          </div>
          <div className="rounded-2xl bg-secondary p-4 text-xs text-muted-foreground">
            Community guidelines: come as you are, walk at your pace, respect privacy, no advice unless asked. Walk session: {walkSessionId.slice(0,8)}.
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Press-and-hold (700ms) end button. The fill animates to 100% so the user
 * sees the commitment building. Tap-only triggers a soft hint instead of ending.
 */
function LongPressEndButton({ onEnd }: { onEnd: () => void }) {
  const [progress, setProgress] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef<number>(0);
  const fired = useRef(false);
  const HOLD = 700;

  const begin = () => {
    fired.current = false;
    start.current = performance.now();
    haptics.tap();
    const tick = () => {
      const p = Math.min(1, (performance.now() - start.current) / HOLD);
      setProgress(p);
      if (p >= 1 && !fired.current) {
        fired.current = true;
        haptics.success();
        onEnd();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  const cancel = () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    if (!fired.current && progress > 0 && progress < 1) {
      // Tap with no hold — gentle nudge
      toast("Hold to end the walk");
    }
    setProgress(0);
  };

  return (
    <button
      type="button"
      onPointerDown={begin}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      className="relative h-14 flex-1 overflow-hidden rounded-2xl bg-clay text-primary-foreground touch-manipulation md:h-12"
      aria-label="Hold to end walk"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-primary-foreground/20 transition-[width] duration-75"
        style={{ width: `${progress * 100}%` }}
      />
      <span className="relative flex items-center justify-center text-sm font-medium">
        <Square className="mr-2 h-4 w-4" />
        {progress > 0 ? "Hold…" : "End walk"}
      </span>
    </button>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}
function haversine(a: {lat:number;lng:number}, b: {lat:number;lng:number}) {
  const R = 6371000; const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat); const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
