import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Shield, Pause, Play, Square, Headphones, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AudioRoomPanel } from "@/components/audio-room-panel";

export const Route = createFileRoute("/walk/active/$id")({ component: ActiveWalk });

const FEELINGS = ["anxious","lonely","overwhelmed","sad","burned out","grieving","restless","okay","hopeful","just need company","prefer not to say"];

interface Session {
  id: string; walk_type: string; mood_before: string | null; intention: string | null;
  started_at: string; status: string; mood_before_score: number | null;
}

function ActiveWalk() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/" });
  }, [loading, user, navigate]);

  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [meters, setMeters] = useState(0);
  const [hasMoved, setHasMoved] = useState(false);
  const [audioRooms, setAudioRooms] = useState<Array<{id:string;title:string;theme:string|null;current_participant_count:number;max_participants:number}>>([]);
  const [activeRoom, setActiveRoom] = useState<{id:string;title:string;capacity:number} | null>(null);
  const [ending, setEnding] = useState(false);
  const [moodAfter, setMoodAfter] = useState("");
  const [moodAfterScore, setMoodAfterScore] = useState<number | null>(null);
  const [reflection, setReflection] = useState("");
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
      if (lastPos.current) {
        const d = haversine(lastPos.current, p);
        if (d < 200) setMeters((m) => m + d); // ignore wild jumps
      }
      lastPos.current = p;
      if (meters > 15) setHasMoved(true);
    }, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
    return () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (meters > 15) setHasMoved(true);
  }, [meters]);

  useEffect(() => {
    if (session?.walk_type === "audio" && hasMoved) {
      supabase.from("audio_rooms").select("id,title,theme,current_participant_count,max_participants").eq("status","open").limit(8)
        .then(({ data }) => setAudioRooms(data ?? []));
    }
  }, [session?.walk_type, hasMoved]);

  const miles = meters * 0.000621371;
  const stride = 0.78;
  const steps = Math.round(meters / stride);

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

  if (!session) return <div className="py-20 text-center font-serif text-muted-foreground">a quiet moment…</div>;

  if (ending) {
    return (
      <div className="mx-auto max-w-lg space-y-5 pt-6">
        <h2 className="font-serif text-3xl">How are you feeling now?</h2>
        <div className="flex flex-wrap gap-2">
          {FEELINGS.map((f) => (
            <button key={f} onClick={() => setMoodAfter(f)} className={`rounded-full border px-4 py-2 text-sm ${moodAfter === f ? "border-forest bg-forest text-primary-foreground" : "border-border bg-card"}`}>{f}</button>
          ))}
        </div>
        <div>
          <label className="text-sm text-muted-foreground">1 → 10</label>
          <input type="range" min={1} max={10} value={moodAfterScore ?? 5} onChange={(e) => setMoodAfterScore(Number(e.target.value))} className="mt-2 w-full accent-[var(--forest)]" />
        </div>
        <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} rows={3} placeholder="Anything you'd like to remember?" className="w-full rounded-2xl border border-border bg-card p-4 text-sm" />
        <Button onClick={endWalk} className="h-14 w-full rounded-2xl bg-forest text-primary-foreground hover:opacity-90">Save walk</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl gradient-forest p-8 text-primary-foreground shadow-elevated">
        <div className="flex items-start justify-between">
          <p className="font-serif text-sm italic opacity-90">{session.intention || (session.walk_type === "solo" ? "Walking alone still counts." : "On your feet.")}</p>
          <SafetyButton walkSessionId={session.id} />
        </div>
        <div className="mt-8 text-center">
          <div className="font-serif text-6xl tabular-nums tracking-tight">{fmt(elapsed)}</div>
          <div className="mt-1 text-xs uppercase tracking-widest opacity-80">elapsed</div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 text-center">
          <div><div className="font-serif text-2xl tabular-nums">{miles.toFixed(2)}</div><div className="text-xs opacity-80">miles</div></div>
          <div><div className="font-serif text-2xl tabular-nums">{steps.toLocaleString()}</div><div className="text-xs opacity-80">steps (est)</div></div>
        </div>
      </div>

      {session.walk_type === "audio" && activeRoom && (
        <AudioRoomPanel
          roomId={activeRoom.id}
          walkSessionId={session.id}
          roomTitle={activeRoom.title}
          capacity={activeRoom.capacity}
          onLeave={() => setActiveRoom(null)}
        />
      )}

      {session.walk_type === "audio" && !activeRoom && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Headphones className="h-4 w-4 text-forest" /> Live group walks
          </div>
          {!hasMoved ? (
            <div className="rounded-xl bg-secondary p-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Confirming you're walking…</span>
              <p className="mt-1 text-xs">Group walks happen on your feet. Take a few steps to unlock.</p>
            </div>
          ) : audioRooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No live rooms right now. Keep walking — one may open soon.</p>
          ) : (
            <ul className="space-y-2">
              {audioRooms.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <div className="text-sm font-medium">{r.title}</div>
                    <div className="text-xs text-muted-foreground">{r.theme} · {r.current_participant_count}/{r.max_participants}</div>
                  </div>
                  <Button
                    size="sm"
                    className="rounded-full bg-forest text-primary-foreground hover:opacity-90"
                    disabled={r.current_participant_count >= r.max_participants}
                    onClick={() => setActiveRoom({ id: r.id, title: r.title, capacity: r.max_participants })}
                  >
                    {r.current_participant_count >= r.max_participants ? "Full" : "Join"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setPaused((p) => !p)} className="h-14 flex-1 rounded-2xl">
          {paused ? <><Play className="mr-2 h-4 w-4" />Resume</> : <><Pause className="mr-2 h-4 w-4" />Pause</>}
        </Button>
        <Button onClick={() => setEnding(true)} className="h-14 flex-1 rounded-2xl bg-clay text-primary-foreground hover:opacity-90">
          <Square className="mr-2 h-4 w-4" />End walk
        </Button>
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
