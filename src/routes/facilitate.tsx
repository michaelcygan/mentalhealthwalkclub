import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Headphones, Play, Pause, LogOut, AlertTriangle, ArrowRight, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { useAudioRoom } from "@/lib/audio/use-audio-room";
import { supabase } from "@/integrations/supabase/client";
import {
  startFacilitatorShift,
  endFacilitatorShift,
  setFacilitatorBreak,
  nextPodForFacilitator,
  joinPodAsFacilitator,
  leavePodAsFacilitator,
  getFacilitatorOverview,
} from "@/server/facilitator.functions";
import { TimerRing } from "@/components/facilitator/timer-ring";
import { WhisperPrompts } from "@/components/facilitator/whisper-prompts";
import { FacilitatorQueue } from "@/components/facilitator/facilitator-queue";
import { ReportDialog } from "@/components/facilitator/report-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/facilitate")({
  component: FacilitatePage,
  head: () => ({
    meta: [
      { title: "Facilitate · Walk Club" },
      { name: "description", content: "Hold space for live Walk & Talks. Drop in, listen, gently guide." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Phase = "idle" | "searching" | "in-pod" | "between" | "break";

function FacilitatePage() {
  const { user } = useAuth();
  const { openAuth } = useAuthPrompt();

  const startFn = useServerFn(startFacilitatorShift);
  const endFn = useServerFn(endFacilitatorShift);
  const breakFn = useServerFn(setFacilitatorBreak);
  const nextFn = useServerFn(nextPodForFacilitator);
  const joinFn = useServerFn(joinPodAsFacilitator);
  const leaveFn = useServerFn(leavePodAsFacilitator);
  const overviewFn = useServerFn(getFacilitatorOverview);

  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getFacilitatorOverview>> | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [visit, setVisit] = useState<{ visitId: string; roomId: string; title: string } | null>(null);
  const [visitDuration, setVisitDuration] = useState(300); // 5 min default
  const [timerDone, setTimerDone] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [profiles, setProfiles] = useState<Record<string, { display_name: string | null; avatar_url: string | null }>>({});
  const pollRef = useRef<number | null>(null);

  // Load overview on mount
  useEffect(() => {
    if (!user) return;
    overviewFn().then(setOverview).catch(() => {});
  }, [user, overviewFn]);

  // Audio in active pod
  const { participants, status, muted, toggleMute, leave: leaveTransport } = useAudioRoom(
    phase === "in-pod" ? visit?.roomId ?? null : null,
    user?.id ?? null,
    phase === "in-pod",
  );

  // Facilitators are unmuted by default — flip the initial mute when joining
  useEffect(() => {
    if (phase === "in-pod" && muted) toggleMute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, visit?.roomId]);

  // Walker profiles for report dialog
  const walkerIds = useMemo(
    () => participants.filter((p) => p.userId !== user?.id).map((p) => p.userId),
    [participants, user?.id],
  );
  useEffect(() => {
    const missing = walkerIds.filter((id) => !profiles[id]);
    if (missing.length === 0) return;
    supabase.from("profiles").select("id,display_name,avatar_url").in("id", missing).then(({ data }) => {
      if (!data) return;
      setProfiles((prev) => {
        const next = { ...prev };
        for (const p of data) next[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
        return next;
      });
    });
  }, [walkerIds, profiles]);

  const findNextPod = useCallback(async () => {
    if (!sessionId) return;
    try {
      const r = await nextFn({ data: { sessionId } });
      if (r.status === "no_pods") return;
      const j = await joinFn({
        data: { sessionId, roomId: r.roomId, plannedDurationSeconds: visitDuration },
      });
      setVisit({ visitId: j.visitId!, roomId: j.roomId, title: j.title });
      setTimerDone(false);
      setPhase("in-pod");
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch (e) {
      // Race or transient — keep polling
      console.warn("nextPod failed", e);
    }
  }, [sessionId, visitDuration, nextFn, joinFn]);

  // Polling for next pod while searching
  useEffect(() => {
    if (phase !== "searching" || !sessionId) return;
    findNextPod();
    pollRef.current = window.setInterval(findNextPod, 30_000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [phase, sessionId, findNextPod]);

  // Realtime: detect pod closing or going empty mid-visit
  useEffect(() => {
    if (phase !== "in-pod" || !visit) return;
    const ch = supabase
      .channel(`facilitator-room-${visit.roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "audio_rooms", filter: `id=eq.${visit.roomId}` },
        (payload) => {
          const next = payload.new as { status: string };
          if (next.status === "closed") {
            toast("This walk ended. Finding the next one…");
            handleLeave("pod_ended");
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [phase, visit?.roomId]);

  const handleStart = async () => {
    if (!user) {
      openAuth("signin");
      return;
    }
    try {
      const r = await startFn();
      setSessionId(r.sessionId);
      setPhase("searching");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleLeave = async (outcome: "completed" | "left_early" | "pod_ended" = "completed") => {
    if (!visit || !sessionId) return;
    await leaveTransport();
    try {
      await leaveFn({
        data: { sessionId, visitId: visit.visitId, roomId: visit.roomId, outcome, notes: null },
      });
    } catch (e) {
      console.warn(e);
    }
    setVisit(null);
    setPhase("between");
    // Brief breath, then resume searching
    window.setTimeout(() => setPhase("searching"), 4000);
  };

  const handleEndShift = async () => {
    if (!sessionId) return;
    if (visit) {
      await leaveTransport();
    }
    try {
      await endFn({ data: { sessionId } });
    } catch {}
    setSessionId(null);
    setVisit(null);
    setPhase("idle");
    overviewFn().then(setOverview).catch(() => {});
  };

  const handleBreak = async (onBreak: boolean) => {
    if (!sessionId) return;
    await breakFn({ data: { sessionId, onBreak } });
    setPhase(onBreak ? "break" : "searching");
  };

  // ── Gates ─────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <Headphones className="mx-auto h-8 w-8 text-forest" />
        <h1 className="mt-3 font-serif text-2xl">Facilitator</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to your facilitator account to begin.</p>
        <Button onClick={() => openAuth("signin")} className="mt-4 rounded-full bg-forest text-primary-foreground hover:opacity-90">
          Sign in
        </Button>
      </div>
    );
  }

  if (overview && !overview.isFacilitator) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <Headphones className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-3 font-serif text-2xl">Facilitator only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This space is for trained volunteer facilitators — therapists and psychology students who hold space for live walks.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Interested? Tell us through the Profile page and we'll be in touch.
        </p>
      </div>
    );
  }

  if (overview && overview.isFacilitator && overview.status && overview.status !== "approved") {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <Headphones className="mx-auto h-8 w-8 text-clay" />
        <h1 className="mt-3 font-serif text-2xl">Almost ready</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your facilitator account is <strong>{overview.status}</strong>. We'll let you know once you're approved to start holding space.
        </p>
      </div>
    );
  }

  // ── Phases ────────────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <div className="space-y-5">
        <div className="overflow-hidden rounded-3xl border border-forest/20 bg-gradient-to-br from-accent/40 via-card to-card p-7">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-forest">
            <Headphones className="h-3 w-3" /> Facilitator
          </div>
          <h1 className="mt-2 font-serif text-3xl">Hold space for a walk.</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Press play and we'll route you through live Walk & Talks. Drop in, listen, ask gentle questions, then move on. Your presence is announced; the walk continues if you leave.
          </p>

          <div className="mt-5 space-y-3">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Time per pod
            </label>
            <div className="flex gap-1.5">
              {[180, 300, 480].map((s) => (
                <button
                  key={s}
                  onClick={() => setVisitDuration(s)}
                  className={`rounded-full px-3 py-1.5 text-xs ${
                    visitDuration === s
                      ? "bg-forest text-primary-foreground"
                      : "border border-border text-foreground"
                  }`}
                >
                  {s / 60} min
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleStart}
            className="mt-6 h-14 w-full rounded-2xl bg-forest text-primary-foreground hover:opacity-90"
          >
            <Play className="mr-2 h-4 w-4" /> Start facilitating
          </Button>
        </div>

        {overview && (
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Pods today" value={`${overview.podsToday}`} />
            <Stat label="Minutes held" value={`${Math.round(overview.secondsToday / 60)}`} />
            <Stat label="Live walks now" value={`${overview.livePodCount}`} />
          </div>
        )}
      </div>
    );
  }

  if (phase === "searching") {
    return (
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-forest/20 via-accent/40 to-cream p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center">
            <span className="absolute h-16 w-16 animate-ping rounded-full bg-forest/30" />
            <span className="relative h-3 w-3 rounded-full bg-forest" />
          </div>
          <p className="mt-6 font-serif text-base italic">listening for walks that need you…</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {overview?.livePodCount ?? 0} live walks right now
          </p>
        </div>
        <FacilitatorQueue />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleBreak(true)} className="flex-1 rounded-full">
            <Pause className="mr-2 h-4 w-4" /> Take a break
          </Button>
          <Button variant="outline" onClick={handleEndShift} className="flex-1 rounded-full">
            <LogOut className="mr-2 h-4 w-4" /> End shift
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "break") {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-border bg-card p-8 text-center">
          <Pause className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 font-serif text-lg">On a break.</p>
          <p className="mt-1 text-xs text-muted-foreground">No pods will be routed to you right now.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleBreak(false)} className="flex-1 rounded-full bg-forest text-primary-foreground">
            <Play className="mr-2 h-4 w-4" /> Resume
          </Button>
          <Button variant="outline" onClick={handleEndShift} className="flex-1 rounded-full">
            End shift
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "between") {
    return (
      <div className="rounded-3xl border border-border bg-card p-10 text-center">
        <div className="mx-auto h-2 w-2 animate-pulse rounded-full bg-forest" />
        <p className="mt-4 font-serif text-lg italic">Nice work. Resetting…</p>
      </div>
    );
  }

  // in-pod
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-card/90 p-5 shadow-elevated">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-forest">
              <Headphones className="h-3 w-3" /> Facilitating · live
            </div>
            <div className="mt-0.5 font-serif text-lg">{visit?.title}</div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              {participants.length - 1 < 0 ? 0 : participants.length - 1} walking
            </div>
          </div>
          <div>
            <TimerRing
              startSeconds={visitDuration}
              onZero={() => setTimerDone(true)}
              onTick={setElapsed}
            />
          </div>
        </div>

        <div className="mt-4">
          {timerDone ? (
            <Button
              onClick={() => handleLeave("completed")}
              className="h-14 w-full rounded-2xl bg-forest text-primary-foreground hover:opacity-90"
            >
              Next walk <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={toggleMute}
              variant={muted ? "outline" : "default"}
              className={`h-14 w-full rounded-2xl ${muted ? "" : "bg-forest text-primary-foreground hover:opacity-90"}`}
            >
              {muted ? "Unmute mic" : "Mic on"}
            </Button>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs">
          <button
            onClick={() => handleLeave("left_early")}
            className="rounded-full border border-border px-3 py-1.5 text-muted-foreground hover:border-forest/40 hover:text-foreground"
          >
            Leave quietly
          </button>
          <button
            onClick={() => setShowReport(true)}
            className="flex items-center gap-1.5 rounded-full border border-clay/40 px-3 py-1.5 text-clay hover:bg-clay/10"
          >
            <AlertTriangle className="h-3 w-3" />
            Close & report
          </button>
        </div>

        {(status === "connecting" || status === "requesting-mic") && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> connecting your mic…
          </p>
        )}
      </div>

      <WhisperPrompts elapsedSeconds={elapsed} totalSeconds={visitDuration} paused={showReport} />

      {showReport && visit && sessionId && (
        <ReportDialog
          sessionId={sessionId}
          visitId={visit.visitId}
          roomId={visit.roomId}
          walkers={walkerIds.map((id) => ({
            userId: id,
            name: profiles[id]?.display_name ?? "walker",
          }))}
          onClose={() => setShowReport(false)}
          onReported={() => {
            setShowReport(false);
            setVisit(null);
            setPhase("between");
            window.setTimeout(() => setPhase("searching"), 4000);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="font-serif text-2xl">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
