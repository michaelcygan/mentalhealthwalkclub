import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Footprints, Headphones } from "lucide-react";
import { toast } from "sonner";
import { EndWalkFlow } from "@/components/end-walk-flow";
import { FriendWalkShareCard } from "@/components/friend-walk/share-card";
import { wakeLock, haptics } from "@/lib/device";
import { AmbientPill } from "@/components/ambient-pill";
import { useAmbient } from "@/lib/ambient-context";
import {
  loadStoredNotes,
  loadStoredPhotos,
  notesToJournalBlock,
  clearWalkCaptures,
  uploadWalkPhotos,
  type WalkNote,
  type WalkPhoto,
} from "@/components/walk-notes-sheet";
import { WalkJournalComposer } from "@/components/active-walk/walk-journal-composer";
import { renderRouteSnapshot } from "@/lib/route-snapshot";
import { getNow as getWeatherNow } from "@/lib/weather";
import { useStepCounter } from "@/hooks/use-step-counter";
import { ActiveWalkShell } from "@/components/active-walk/active-walk-shell";
import type { WalkFormat } from "@/components/active-walk/walk-meta-row";
import { SoloModule } from "@/components/active-walk/format-modules/solo-module";
import { WalkTalkModule } from "@/components/active-walk/format-modules/walk-talk-module";
import { GuidedModule } from "@/components/active-walk/format-modules/guided-module";
import { LocalModule } from "@/components/active-walk/format-modules/local-module";
import { LoadingScreen } from "@/components/loading-screen";
import { PodcastPickerSheet } from "@/components/active-walk/podcast-picker-sheet";

export const Route = createFileRoute("/walk/active/$id")({ component: ActiveWalk });

const PULSE_FEELINGS = ["lighter", "same", "heavier"];

interface Session {
  id: string;
  walk_type: string;
  mood_before: string | null;
  mood_before_score: number | null;
  intention: string | null;
  started_at: string;
  status: string;
  guided_track_id: string | null;
  podcast_episode_id: string | null;
  audio_room_id: string | null;
  group_id: string | null;
  privacy: string;
  share_map: boolean;
}
interface FriendRoom {
  id: string;
  share_code: string | null;
  host_user_id: string | null;
}

type GpsState = "idle" | "live" | "weak" | "denied";

function ActiveWalk() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/" });
  }, [loading, user, navigate]);

  // Keep the screen on while a walk is active
  useEffect(() => {
    let release: (() => void) | undefined;
    wakeLock().then((r) => {
      release = r;
    });
    return () => {
      release?.();
    };
  }, []);

  // Tint the iOS/Android status bar to forest while walking
  useEffect(() => {
    if (typeof document === "undefined") return;
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    const prev = meta?.getAttribute("content") ?? null;
    if (meta) meta.setAttribute("content", "#1f3a2c");
    return () => {
      if (meta && prev !== null) meta.setAttribute("content", prev);
    };
  }, []);

  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [meters, setMeters] = useState(0);
  const [walkerCoords, setWalkerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  const [ending, setEnding] = useState(false);
  const [, setRouteTick] = useState(0);
  const [gps, setGps] = useState<GpsState>("idle");
  const [showManualStart, setShowManualStart] = useState(false);
  const milestonesHit = useRef<Set<string>>(new Set());
  const pulseHit = useRef<Set<number>>(new Set());
  const lastPos = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const points = useRef<Array<{ lat: number; lng: number; t: number }>>([]);
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
  const [shareMap, setShareMap] = useState(false);

  useEffect(() => {
    supabase
      .from("walk_sessions")
      .select("id,walk_type,mood_before,mood_before_score,intention,started_at,status,guided_track_id,podcast_episode_id,audio_room_id,group_id,privacy,share_map")
      .eq("id", id)
      .single()
      .then(async ({ data }) => {
        if (!data) return;
        setSession(data as Session);
        setShareMap(!!(data as Session).share_map);
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
    const t = setInterval(() => {
      if (!paused) setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [session, paused]);

  // Rehydrate any previously-saved route for this session
  const rehydrated = useRef(false);
  useEffect(() => {
    if (rehydrated.current || !session) return;
    rehydrated.current = true;
    supabase
      .from("walk_routes")
      .select("points")
      .eq("walk_session_id", session.id)
      .maybeSingle()
      .then(({ data }) => {
        const raw =
          (data?.points as Array<{ lat: number; lng: number; t?: number }> | null) ?? null;
        if (!raw || raw.length === 0) return;
        const pts = raw.map((p) => ({
          lat: p.lat,
          lng: p.lng,
          t: typeof p.t === "number" ? p.t : Date.now(),
        }));
        points.current = pts;
        let total = 0;
        for (let i = 1; i < pts.length; i++) total += haversine(pts[i - 1], pts[i]);
        setMeters((m) => Math.max(m, total));
        lastPos.current = pts[pts.length - 1];
        setWalkerCoords({ lat: pts[pts.length - 1].lat, lng: pts[pts.length - 1].lng });
        setRouteTick((x) => x + 1);
      });
  }, [session]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGps("denied");
      return;
    }
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const acc = pos.coords.accuracy ?? 999;
        if (acc > 60) {
          setGps((g) => (g === "live" ? "live" : "weak"));
          return;
        }
        if (acc > 30) {
          setGps("weak");
          return;
        }
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, t: Date.now() };
        const minDelta = 5;
        if (lastPos.current) {
          const d = haversine(lastPos.current, p);
          if (d >= minDelta && d < 200) {
            const prev = points.current[points.current.length - 1];
            const prev2 = points.current[points.current.length - 2];
            const smoothed =
              prev2 && prev
                ? {
                    lat: (prev2.lat + prev.lat + p.lat) / 3,
                    lng: (prev2.lng + prev.lng + p.lng) / 3,
                    t: p.t,
                  }
                : p;
            setMeters((m) => m + d);
            points.current.push(smoothed);
            setRouteTick((x) => x + 1);
            lastPos.current = p;
            setWalkerCoords({ lat: smoothed.lat, lng: smoothed.lng });
            setGps("live");
          }
        } else {
          lastPos.current = p;
          points.current.push(p);
          setGps("live");
          setWalkerCoords({ lat: p.lat, lng: p.lng });
        }
      },
      (err) => {
        setGps(err.code === err.PERMISSION_DENIED ? "denied" : "weak");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  const motion = useStepCounter(!paused);

  // Motion sensor is a *fallback*: only surface a quiet hint if (a) GPS isn't
  // working after a 30s grace, or (b) GPS is live but we've gotten no motion
  // detected at all after 90s of walking. Once the user taps (granted or
  // denied) we never show again this session.
  const [motionHintShown, setMotionHintShown] = useState(false);
  const motionDismissed = useRef(false);
  useEffect(() => {
    if (motion.permissionState !== "needed" || motionDismissed.current) {
      setMotionHintShown(false);
      return;
    }
    const tick = () => {
      const gpsBad = gps === "denied" || gps === "weak";
      const gpsLiveButNoSteps = gps === "live" && elapsed > 90 && motion.steps === 0 && meters < 30;
      setMotionHintShown(gpsBad ? elapsed > 30 : gpsLiveButNoSteps);
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [gps, elapsed, meters, motion.steps, motion.permissionState]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!hasMoved) setShowManualStart(true);
    }, 25_000);
    return () => clearTimeout(t);
  }, [hasMoved]);

  useEffect(() => {
    if (meters > 15 || motion.steps > 25) setHasMoved(true);
  }, [meters, motion.steps]);

  useEffect(() => {
    if (!session || session.walk_type !== "audio") return;
    type WakeLockSentinel = { release: () => Promise<void> };
    let lock: WakeLockSentinel | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> };
    };
    nav.wakeLock
      ?.request("screen")
      .then((l) => {
        lock = l;
      })
      .catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, [session]);

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
      lighter: {
        mood: "hopeful",
        score: Math.min(10, (session?.mood_before_score ?? 5) + 2),
      },
      same: {
        mood: session?.mood_before ?? "okay",
        score: session?.mood_before_score ?? 5,
      },
      heavier: {
        mood: "still heavy",
        score: Math.max(1, (session?.mood_before_score ?? 5) - 1),
      },
    };
    pulseRecord.current = map[label];
    toast(`Noted · feeling ${label}`);
  };

  useEffect(() => {
    const mins = Math.floor(elapsed / 60);
    if (mins > 0 && mins % 10 === 0 && elapsed % 60 === 0 && !pulseHit.current.has(mins)) {
      pulseHit.current.add(mins);
      toast.custom(
        (t) => (
          <div className="flex items-center gap-2 rounded-2xl border border-forest/30 bg-card/95 p-3 shadow-elevated backdrop-blur">
            <span className="text-xs font-medium text-forest">Quick check-in</span>
            {PULSE_FEELINGS.map((f) => (
              <button
                key={f}
                onClick={() => {
                  recordPulse(f);
                  toast.dismiss(t);
                }}
                className="rounded-full border border-border bg-background px-2.5 py-1 text-xs hover:border-forest/40"
              >
                {f}
              </button>
            ))}
          </div>
        ),
        { duration: 30_000 },
      );
    }
  }, [elapsed]);

  const stride = 0.78;
  const gpsSteps = Math.round(meters / stride);
  const steps = Math.max(gpsSteps, motion.steps);
  const inferredMeters = motion.steps > gpsSteps ? motion.steps * stride : meters;
  const displayMiles = inferredMeters * 0.000621371;
  const paceMinPerMi = displayMiles > 0.05 ? elapsed / 60 / displayMiles : 0;
  const cadence = elapsed > 30 && steps > 50 ? Math.round((steps / elapsed) * 60) : 0;

  // Persist progress every 30s
  useEffect(() => {
    if (!session || !user) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled || paused) return;
      const dur = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
      const distance = Math.round(Math.max(meters, motion.steps * stride));
      await supabase
        .from("walk_sessions")
        .update({ distance_meters: distance, steps, duration_seconds: dur })
        .eq("id", session.id);
      if (points.current.length > 1) {
        await supabase.from("walk_routes").upsert(
          { walk_session_id: session.id, user_id: user.id, points: points.current },
          { onConflict: "walk_session_id" },
        );
      }
    };
    const id = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [session, user, paused, meters, motion.steps, steps]);

  // Ambient music: suppress when this walk owns the audio channel
  const ambient = useAmbient();
  useEffect(() => {
    if (!session) return;
    const ownsAudio = session.walk_type === "audio" || !!session.guided_track_id || !!session.podcast_episode_id;
    if (ownsAudio) ambient.stop(300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);
  useEffect(
    () => () => {
      ambient.stop(800);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const endWalk = async (out: {
    moodAfter: string;
    moodAfterScore: number | null;
    reflection: string;
  }) => {
    if (!user || !session) return;
    const notesBlock = notesToJournalBlock(walkNotes);
    const merged = [out.reflection?.trim(), notesBlock].filter(Boolean).join("\n\n");
    let weatherSnap: Record<string, unknown> | null = null;
    const last = lastPos.current;
    if (last) {
      try {
        const w = await getWeatherNow(last.lat, last.lng);
        if (w) weatherSnap = w as unknown as Record<string, unknown>;
      } catch {
        /* best-effort */
      }
    }
    await supabase
      .from("walk_sessions")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        duration_seconds: elapsed,
        distance_meters: Math.round(Math.max(meters, motion.steps * stride)),
        steps,
        mood_after: out.moodAfter || pulseRecord.current?.mood || null,
        mood_after_score: out.moodAfterScore ?? pulseRecord.current?.score ?? null,
        reflection_note: merged || null,
        weather_at_end: weatherSnap as never,
      })
      .eq("id", session.id);
    let snapshotPath: string | null = null;
    if (points.current.length > 1) {
      await supabase.from("walk_routes").upsert(
        { walk_session_id: session.id, user_id: user.id, points: points.current },
        { onConflict: "walk_session_id" },
      );
      try {
        const blob = await renderRouteSnapshot(points.current, { width: 1080, height: 1080 });
        if (blob) {
          const path = `${user.id}/${session.id}.png`;
          const { error } = await supabase.storage
            .from("walk-snapshots")
            .upload(path, blob, { contentType: "image/png", upsert: true });
          if (!error) snapshotPath = path;
        }
      } catch {
        /* snapshot is best-effort */
      }
    }
    if (snapshotPath) {
      await supabase
        .from("walk_sessions")
        .update({ route_snapshot_path: snapshotPath })
        .eq("id", session.id);
    }
    if (walkPhotos.length > 0) {
      try {
        await uploadWalkPhotos({
          supabase,
          userId: user.id,
          walkSessionId: session.id,
          photos: walkPhotos,
        });
      } catch {
        toast.error("Some photos couldn't upload");
      }
    }
    await supabase.from("walk_live_pings").delete().eq("walk_session_id", session.id);
    clearWalkCaptures(session.id);
    toast.success("You gave yourself movement and air.");
    navigate({ to: "/journal" as never });
  };

  if (!session) return <LoadingScreen variant="inline" size={32} />;

  if (ending) {
    return (
      <EndWalkFlow
        moodBefore={session.mood_before}
        moodBeforeScore={session.mood_before_score}
        elapsed={elapsed}
        miles={displayMiles}
        savedPrompts={savedPrompts}
        onSave={endWalk}
      />
    );
  }

  const format: WalkFormat =
    session.walk_type === "audio"
      ? "audio"
      : (session.guided_track_id || session.podcast_episode_id)
        ? "guided"
        : friendRoom
          ? "friend"
          : session.group_id && session.privacy === "public"
            ? "local"
            : "solo";

  const formatModule =
    format === "audio" || format === "friend" ? (
      <WalkTalkModule
        walkSessionId={session.id}
        mood={session.mood_before}
        hasMoved={hasMoved}
        intention={session.intention}
        savedPrompts={savedPrompts}
        onSavePrompt={handleSavePrompt}
        friendRoom={friendRoom}
        currentUserId={user?.id ?? null}
        onInvite={() => setFriendShareOpen(true)}
      />
    ) : format === "guided" && (session.guided_track_id || session.podcast_episode_id) ? (
      <GuidedModule
        trackId={session.guided_track_id}
        podcastEpisodeId={session.podcast_episode_id}
        paused={paused}
        intention={session.intention}
        savedPrompts={savedPrompts}
      />
    ) : format === "local" ? (
      <LocalModule intention={session.intention} savedPrompts={savedPrompts} />
    ) : (
      <SoloModule intention={session.intention} savedPrompts={savedPrompts} />
    );

  const setupNudges = (
    <>
      {showManualStart && !hasMoved && (
        <button
          onClick={() => {
            setHasMoved(true);
            setShowManualStart(false);
            toast("On your feet — counting you in.");
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs text-muted-foreground transition active:scale-95"
        >
          <Footprints className="h-3.5 w-3.5" /> I'm walking — start the room
        </button>
      )}
    </>
  );

  const hasNudges = showManualStart && !hasMoved;

  const stepsHint =
    motionHintShown && !motionDismissed.current ? (
      <button
        type="button"
        onClick={async () => {
          motionDismissed.current = true;
          setMotionHintShown(false);
          const r = await motion.request();
          if (r === "granted") toast("Motion sensor on — counting your steps");
          else if (r === "denied") toast("Motion blocked — using GPS only");
        }}
        className="text-[10px] italic text-muted-foreground/80 underline decoration-dotted underline-offset-2 transition hover:text-foreground"
      >
        also count via motion
      </button>
    ) : null;

  const utilityRow = (
    <>
      <WalkJournalComposer
        walkSessionId={session.id}
        elapsed={elapsed}
        notes={walkNotes}
        photos={walkPhotos}
        onChangeNotes={setWalkNotes}
        onChangePhotos={setWalkPhotos}
      />
      {!(session.walk_type === "audio" || session.guided_track_id || session.podcast_episode_id) && (
        <div className="flex justify-center">
          <AmbientPill />
        </div>
      )}
    </>
  );

  const handleToggleShareMap = async () => {
    const next = !shareMap;
    setShareMap(next);
    haptics.tap();
    const { error } = await supabase
      .from("walk_sessions")
      .update({ share_map: next })
      .eq("id", session.id);
    if (error) {
      setShareMap(!next);
      toast.error("Couldn't update sharing");
      return;
    }
    toast(next ? "Visible on group map" : "Hidden from group map");
  };

  return (
    <>
      <ActiveWalkShell
        format={format}
        walkSessionId={session.id}
        userId={user?.id ?? null}
        groupId={session.group_id}
        elapsed={elapsed}
        paused={paused}
        gps={gps}
        miles={displayMiles}
        steps={steps}
        paceMinPerMi={paceMinPerMi}
        cadence={cadence}
        stepsHint={stepsHint}
        walkerCoords={walkerCoords}
        routePoints={points.current.slice()}
        canShareMap={session.privacy === "public" && !!session.group_id}
        shareMap={shareMap}
        onToggleShareMap={handleToggleShareMap}
        onTogglePause={() => setPaused((p) => !p)}
        onEnd={() => setEnding(true)}
        setupNudges={hasNudges ? setupNudges : undefined}
        formatModule={formatModule}
        utilityRow={utilityRow}
      />
      {friendRoom?.share_code && (
        <FriendWalkShareCard
          open={friendShareOpen}
          onOpenChange={setFriendShareOpen}
          hostName={user?.user_metadata?.display_name || user?.email?.split("@")[0] || "a friend"}
          hostAvatarUrl={user?.user_metadata?.avatar_url ?? null}
          shareCode={friendRoom.share_code}
        />
      )}
    </>
  );
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
