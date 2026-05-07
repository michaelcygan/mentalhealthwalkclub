import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Shield, Pause, Play, Square, AlertTriangle, Heart, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AudioRoomPanel } from "@/components/audio-room-panel";
import { RouteSparkline } from "@/components/route-sparkline";
import { WalkTalkDock } from "@/components/walk-talk-dock";

export const Route = createFileRoute("/walk/active/$id")({ component: ActiveWalk });

const FEELINGS = ["anxious","lonely","overwhelmed","sad","burned out","grieving","restless","okay","hopeful","just need company","prefer not to say"];
const PULSE_FEELINGS = ["lighter", "same", "heavier"];

interface Session {
  id: string; walk_type: string; mood_before: string | null; mood_before_score: number | null;
  intention: string | null; started_at: string; status: string;
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
  const [endStep, setEndStep] = useState<0 | 1 | 2 | 3>(0);
  const [moodAfter, setMoodAfter] = useState("");
  const [moodAfterScore, setMoodAfterScore] = useState<number | null>(null);
  const [reflection, setReflection] = useState("");
  const [pulseHint, setPulseHint] = useState<string | null>(null);
  const [routeTick, setRouteTick] = useState(0);
  const milestonesHit = useRef<Set<string>>(new Set());
  const lastPos = useRef<{lat:number;lng:number;t:number} | null>(null);
  const points = useRef<Array<{lat:number;lng:number;t:number}>>([]);
  const watchId = useRef<number | null>(null);

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

  useEffect(() => {
    if (session?.walk_type === "audio" && hasMoved) {
      supabase.from("audio_rooms").select("id,title,theme,current_participant_count,max_participants").eq("status","open").limit(8)
        .then(({ data }) => setAudioRooms(data ?? []));
    }
  }, [session?.walk_type, hasMoved]);

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
    const v = map[label];
    setMoodAfter(v.mood);
    setMoodAfterScore(v.score);
    toast(`Noted · feeling ${label}`);
  };

  const endWalk = async () => {
    if (!user || !session) return;
    await supabase.from("walk_sessions").update({
      status: "completed",
      ended_at: new Date().toISOString(),
      duration_seconds: elapsed,
      distance_meters: Math.round(meters),
      steps,
      mood_after: moodAfter || null,
      mood_after_score: moodAfterScore,
      reflection_note: reflection || null,
    }).eq("id", session.id);
    if (points.current.length > 1) {
      await supabase.from("walk_routes").insert({ walk_session_id: session.id, user_id: user.id, points: points.current });
    }
    toast.success("You gave yourself movement and air.");
    navigate({ to: "/journal" as never });
  };

  const delta = useMemo(() => {
    if (session?.mood_before_score && moodAfterScore) return moodAfterScore - session.mood_before_score;
    return null;
  }, [session, moodAfterScore]);

  if (!session) return <div className="py-20 text-center font-serif text-muted-foreground">a quiet moment…</div>;

  // Reflection flow
  if (ending) {
    return (
      <div className="mx-auto max-w-lg space-y-6 pt-6">
        {endStep === 0 && (
          <>
            <div>
              <p className="font-serif text-xs italic text-muted-foreground">You started {session.mood_before ?? "the walk"}.</p>
              <h2 className="mt-1 font-serif text-3xl">How are you arriving?</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {FEELINGS.map((f) => (
                <button key={f} onClick={() => { setMoodAfter(f); setEndStep(1); }} className={`rounded-full border px-4 py-2 text-sm transition ${moodAfter === f ? "border-forest bg-forest text-primary-foreground" : "border-border bg-card hover:border-forest/40"}`}>{f}</button>
              ))}
            </div>
            <button onClick={() => setEndStep(1)} className="text-xs text-muted-foreground underline">skip</button>
          </>
        )}
        {endStep === 1 && (
          <>
            <h2 className="font-serif text-3xl">On a scale of weight…</h2>
            <p className="text-sm text-muted-foreground">1 (heavy) → 10 (light)</p>
            <input type="range" min={1} max={10} value={moodAfterScore ?? 5} onChange={(e) => setMoodAfterScore(Number(e.target.value))} className="w-full accent-[var(--forest)]" />
            <div className="text-center font-serif text-4xl tabular-nums">{moodAfterScore ?? 5}</div>
            {delta !== null && (
              <div className={`text-center text-sm ${delta > 0 ? "text-forest" : delta < 0 ? "text-clay" : "text-muted-foreground"}`}>
                {delta > 0 ? `+${delta} lighter` : delta < 0 ? `${delta} heavier` : "no change"}
              </div>
            )}
            <Button onClick={() => setEndStep(2)} className="h-12 w-full rounded-2xl bg-forest text-primary-foreground hover:opacity-90">Continue <ArrowRight className="ml-1 h-4 w-4" /></Button>
          </>
        )}
        {endStep === 2 && (
          <>
            <h2 className="font-serif text-3xl">{delta && delta > 0 ? "What shifted?" : delta && delta < 0 ? "What felt hard?" : "Anything to remember?"}</h2>
            <div className="flex flex-wrap gap-2 text-xs">
              {(delta && delta > 0
                ? ["the air helped", "moving through it", "let it go", "small win"]
                : delta && delta < 0
                  ? ["still in it", "needed more time", "tomorrow", "showed up anyway"]
                  : ["just walked", "needed this", "quiet"]
              ).map((s) => (
                <button key={s} onClick={() => setReflection((r) => r ? `${r} · ${s}` : s)} className="rounded-full border border-border bg-card px-3 py-1.5 hover:border-forest/40">{s}</button>
              ))}
            </div>
            <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} rows={3} placeholder="A line for future you…" className="w-full rounded-2xl border border-border bg-card p-4 text-sm focus:border-forest focus:outline-none" />
            <Button onClick={() => setEndStep(3)} className="h-12 w-full rounded-2xl bg-forest text-primary-foreground hover:opacity-90">Save walk</Button>
          </>
        )}
        {endStep === 3 && (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="rounded-3xl gradient-forest p-10 text-primary-foreground shadow-elevated animate-in fade-in zoom-in duration-700">
              <p className="font-serif text-xs italic opacity-80">{session.mood_before ?? "started"} → {moodAfter || "okay"}</p>
              {delta !== null && <div className="mt-2 font-serif text-6xl tabular-nums">{delta > 0 ? `+${delta}` : delta}</div>}
              <p className="mt-2 text-xs uppercase tracking-widest opacity-80">{Math.round(elapsed / 60)} min · {miles.toFixed(2)} mi</p>
            </div>
            <p className="font-serif italic text-muted-foreground">Still here. Still walking.</p>
            <Button onClick={endWalk} className="rounded-full bg-forest text-primary-foreground hover:opacity-90">Save to journal</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl gradient-forest p-7 text-primary-foreground shadow-elevated">
        <div className="flex items-start justify-between">
          <p className="font-serif text-sm italic opacity-90">{session.intention || (session.walk_type === "solo" ? "Walking alone still counts." : "On your feet.")}</p>
          <SafetyButton walkSessionId={session.id} />
        </div>
        <div className="mt-7 text-center">
          <div className="font-serif text-6xl tabular-nums tracking-tight" style={{ animation: paused ? "none" : "breathe 4s ease-in-out infinite" }}>{fmt(elapsed)}</div>
          <div className="mt-1 text-xs uppercase tracking-widest opacity-80">{paused ? "paused" : "elapsed"}</div>
        </div>
        <div className="mt-7 grid grid-cols-4 gap-2 text-center text-primary-foreground">
          <Mini label="mi" value={miles.toFixed(2)} />
          <Mini label="steps" value={steps.toLocaleString()} />
          <Mini label="pace" value={paceMinPerMi > 0 && paceMinPerMi < 60 ? `${Math.floor(paceMinPerMi)}'${String(Math.round((paceMinPerMi % 1) * 60)).padStart(2,"0")}"` : "—"} />
          <Mini label="cadence" value={cadence > 0 ? cadence.toString() : "—"} />
        </div>
      </div>

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

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Your path</div>
        <RouteSparkline points={points.current} key={routeTick} />
      </div>

      {session.walk_type === "audio" && (
        <WalkTalkDock walkSessionId={session.id} mood={session.mood_before} hasMoved={hasMoved} />
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setPaused((p) => !p)} className="h-14 flex-1 rounded-2xl">
          {paused ? <><Play className="mr-2 h-4 w-4" />Resume</> : <><Pause className="mr-2 h-4 w-4" />Pause</>}
        </Button>
        <Button onClick={() => setEnding(true)} className="h-14 flex-1 rounded-2xl bg-clay text-primary-foreground hover:opacity-90">
          <Square className="mr-2 h-4 w-4" />End walk
        </Button>
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
