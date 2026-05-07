import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Shield, Pause, Play, Square, AlertTriangle, Heart } from "lucide-react";
import { toast } from "sonner";
import { RouteSparkline } from "@/components/route-sparkline";
import { WalkTalkDock } from "@/components/walk-talk-dock";
import { EndWalkFlow } from "@/components/end-walk-flow";
import { GuidedPlayer } from "@/components/guided-player";

export const Route = createFileRoute("/walk/active/$id")({ component: ActiveWalk });

const PULSE_FEELINGS = ["lighter", "same", "heavier"];

interface Session {
  id: string; walk_type: string; mood_before: string | null; mood_before_score: number | null;
  intention: string | null; started_at: string; status: string; guided_track_id: string | null;
}

function ActiveWalk() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/" }); }, [loading, user, navigate]);

  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [meters, setMeters] = useState(0);
  const [hasMoved, setHasMoved] = useState(false);
  const [ending, setEnding] = useState(false);
  const [pulseHint, setPulseHint] = useState<string | null>(null);
  const [routeTick, setRouteTick] = useState(0);
  const milestonesHit = useRef<Set<string>>(new Set());
  const lastPos = useRef<{lat:number;lng:number;t:number} | null>(null);
  const points = useRef<Array<{lat:number;lng:number;t:number}>>([]);
  const watchId = useRef<number | null>(null);
  const pulseRecord = useRef<{ mood: string; score: number } | null>(null);

  useEffect(() => {
    supabase.from("walk_sessions").select("*").eq("id", id).single().then(({ data }) => {
      if (data) setSession(data as Session);
    });
  }, [id]);

  useEffect(() => {
    if (!session) return;
    const start = new Date(session.started_at).getTime();
    const t = setInterval(() => { if (!paused) setElapsed(Math.floor((Date.now() - start) / 1000)); }, 1000);
    return () => clearInterval(t);
  }, [session, paused]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    watchId.current = navigator.geolocation.watchPosition((pos) => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, t: Date.now() };
      points.current.push(p);
      setRouteTick((x) => x + 1);
      if (lastPos.current) {
        const d = haversine(lastPos.current, p);
        if (d < 200) setMeters((m) => m + d);
      }
      lastPos.current = p;
    }, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
    return () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); };
  }, []);

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

  // Milestone toasts
  useEffect(() => {
    const mins = Math.floor(elapsed / 60);
    const fire = (k: string, msg: string) => {
      if (milestonesHit.current.has(k)) return;
      milestonesHit.current.add(k);
      toast(msg, { duration: 3500 });
    };
    if (mins >= 5) fire("5m", "5 minutes in · let your shoulders drop");
    if (mins >= 10) fire("10m", "10 minutes · this is the hard part");
    if (mins >= 20) fire("20m", "20 minutes · you're doing the thing");
    if (mins >= 30) fire("30m", "30 minutes · take a breath");
    if (meters >= 1609) fire("1mi", "First mile · proud of you");
  }, [elapsed, meters]);

  // Mood pulse every 10 minutes
  useEffect(() => {
    const mins = Math.floor(elapsed / 60);
    if (mins > 0 && mins % 10 === 0 && elapsed % 60 === 0 && !pulseHint) {
      setPulseHint("ask");
      const t = setTimeout(() => setPulseHint((h) => (h === "ask" ? null : h)), 60_000);
      return () => clearTimeout(t);
    }
  }, [elapsed, pulseHint]);

  const miles = meters * 0.000621371;
  const stride = 0.78;
  const steps = Math.round(meters / stride);
  const paceMinPerMi = miles > 0.05 ? (elapsed / 60) / miles : 0;
  const cadence = elapsed > 30 ? Math.round((steps / elapsed) * 60) : 0;

  const recordPulse = (label: string) => {
    setPulseHint(null);
    const map: Record<string, { mood: string; score: number }> = {
      lighter: { mood: "hopeful", score: Math.min(10, (session?.mood_before_score ?? 5) + 2) },
      same: { mood: session?.mood_before ?? "okay", score: session?.mood_before_score ?? 5 },
      heavier: { mood: "still heavy", score: Math.max(1, (session?.mood_before_score ?? 5) - 1) },
    };
    pulseRecord.current = map[label];
    toast(`Noted · feeling ${label}`);
  };

  const endWalk = async (out: { moodAfter: string; moodAfterScore: number | null; reflection: string }) => {
    if (!user || !session) return;
    await supabase.from("walk_sessions").update({
      status: "completed",
      ended_at: new Date().toISOString(),
      duration_seconds: elapsed,
      distance_meters: Math.round(meters),
      steps,
      mood_after: out.moodAfter || pulseRecord.current?.mood || null,
      mood_after_score: out.moodAfterScore ?? pulseRecord.current?.score ?? null,
      reflection_note: out.reflection || null,
    }).eq("id", session.id);
    if (points.current.length > 1) {
      await supabase.from("walk_routes").insert({ walk_session_id: session.id, user_id: user.id, points: points.current });
    }
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
        onSave={endWalk}
      />
    );
  }

  const isAudio = session.walk_type === "audio";

  return (
    <div className="-mx-4 md:mx-0">
      {/* Hero — full-bleed gradient with breathing timer */}
      <section className="relative overflow-hidden gradient-forest px-5 pb-8 pt-7 text-primary-foreground md:rounded-3xl md:px-7 md:pt-8 md:shadow-elevated">
        {/* sparkline overlay behind everything */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 opacity-20">
          <RouteSparkline points={points.current} key={routeTick} />
        </div>

        <div className="relative flex items-start justify-between">
          <p className="font-serif text-sm italic opacity-90">{session.intention || (isAudio ? "On your feet." : "Walking alone still counts.")}</p>
          <SafetyButton walkSessionId={session.id} />
        </div>

        <div className="relative mt-8 text-center">
          <div className="font-serif text-7xl tabular-nums tracking-tight" style={{ animation: paused ? "none" : "breathe 4s ease-in-out infinite" }}>{fmt(elapsed)}</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.22em] opacity-80">{paused ? "paused" : "elapsed"}</div>
        </div>

        <div className="relative mt-7 grid grid-cols-4 gap-2 text-center">
          <Mini label="mi" value={miles.toFixed(2)} />
          <Mini label="steps" value={steps.toLocaleString()} />
          <Mini label="pace" value={paceMinPerMi > 0 && paceMinPerMi < 60 ? `${Math.floor(paceMinPerMi)}'${String(Math.round((paceMinPerMi % 1) * 60)).padStart(2,"0")}"` : "—"} />
          <Mini label="cadence" value={cadence > 0 ? cadence.toString() : "—"} />
        </div>
      </section>

      <div className="space-y-4 px-4 pt-5 md:px-0">
        {pulseHint === "ask" && (
          <div className="animate-in fade-in slide-in-from-top-2 rounded-2xl border border-forest/30 bg-accent/40 p-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-forest"><Heart className="h-3.5 w-3.5" /> Quick check-in</div>
            <div className="flex gap-2">
              {PULSE_FEELINGS.map((f) => (
                <button key={f} onClick={() => recordPulse(f)} className="flex-1 rounded-full border border-border bg-card px-3 py-2 text-sm hover:border-forest/40">{f}</button>
              ))}
            </div>
          </div>
        )}

        {isAudio && (
          <WalkTalkDock walkSessionId={session.id} mood={session.mood_before} hasMoved={hasMoved} />
        )}
      </div>

      {/* Sticky control dock */}
      <div className="sticky bottom-0 left-0 right-0 z-20 mt-5 border-t border-border bg-card/85 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur md:static md:mt-6 md:border-0 md:bg-transparent md:p-0">
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setPaused((p) => !p)} className="h-14 flex-1 rounded-2xl touch-manipulation">
            {paused ? <><Play className="mr-2 h-4 w-4" />Resume</> : <><Pause className="mr-2 h-4 w-4" />Pause</>}
          </Button>
          <Button onClick={() => setEnding(true)} className="h-14 flex-1 rounded-2xl bg-clay text-primary-foreground touch-manipulation hover:opacity-90">
            <Square className="mr-2 h-4 w-4" />End walk
          </Button>
        </div>
      </div>

      <style>{`@keyframes breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.018); } }`}</style>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-serif text-xl tabular-nums leading-none">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider opacity-75">{label}</div>
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
