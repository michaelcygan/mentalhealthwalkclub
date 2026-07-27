import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Footprints, Loader2, Pause, Play, Radio as RadioIcon } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  abandonSoloWalk,
  completeSoloWalk,
  getActiveSoloWalk,
  saveSoloWalkReflection,
  startSoloWalk,
  type SoloWalkSession,
} from "@/lib/solo-walk.functions";
import {
  SOLO_WALK_MAX_SECONDS,
  SOLO_WALK_REFLECTION_PROMPT,
} from "@/lib/solo-walk.constants";
import { haptics } from "@/lib/device";
import { RadioQuickPicker } from "@/components/radio/radio-quick-picker";
import { usePlayer } from "@/lib/player-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/walk/")({
  head: () => ({
    meta: [
      { title: "Solo walk — Mental Health Walk Club" },
      { name: "description", content: "A private walking timer for your own routine." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WalkPage,
});

type UIState = "loading" | "error" | "ready" | "active" | "timed_out" | "finish";

function draftKey(id: string) {
  return `solo-walk-reflection:${id}`;
}

function fmtElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}:${String(rm).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function fmtMinutes(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.floor(seconds ?? 0));
  const m = Math.round(s / 60);
  if (m < 1) return "under a minute";
  if (m === 1) return "1 minute";
  return `${m} minutes`;
}

function elapsedFor(session: SoloWalkSession): number {
  const startedMs = new Date(session.started_at).getTime();
  return Math.max(0, Math.round((Date.now() - startedMs) / 1000));
}

function WalkPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const fetchActive = useServerFn(getActiveSoloWalk);
  const start = useServerFn(startSoloWalk);
  const complete = useServerFn(completeSoloWalk);
  const abandon = useServerFn(abandonSoloWalk);
  const saveReflection = useServerFn(saveSoloWalkReflection);

  const [ui, setUi] = useState<UIState>("loading");
  const [session, setSession] = useState<SoloWalkSession | null>(null);
  const [reflection, setReflection] = useState<string>("");
  const [moodAfter, setMoodAfter] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [journalOpen, setJournalOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [loadTick, setLoadTick] = useState(0);

  // Initial load — never fall back to Ready on error.
  useEffect(() => {
    let cancelled = false;
    setUi("loading");
    (async () => {
      try {
        const active = await fetchActive();
        if (cancelled) return;
        if (active) {
          setSession(active);
          const el = elapsedFor(active);
          setElapsed(Math.min(el, SOLO_WALK_MAX_SECONDS));
          setUi(el >= SOLO_WALK_MAX_SECONDS ? "timed_out" : "active");
          const draft =
            typeof window !== "undefined" ? window.localStorage.getItem(draftKey(active.id)) : null;
          if (draft) {
            setReflection(draft);
            setJournalOpen(true);
          }
        } else {
          setUi("ready");
        }
      } catch {
        if (!cancelled) setUi("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchActive, loadTick]);

  // Live display clock (timestamp-based; safe when tab backgrounded).
  useEffect(() => {
    if (!session || session.status !== "active") return;
    const tick = () => {
      const el = elapsedFor(session);
      setElapsed(Math.min(el, SOLO_WALK_MAX_SECONDS));
      if (el >= SOLO_WALK_MAX_SECONDS) {
        setUi((prev) => (prev === "active" ? "timed_out" : prev));
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [session]);

  // Persist reflection draft while active/timed_out.
  useEffect(() => {
    if (!session || typeof window === "undefined") return;
    if (session.status !== "active") return;
    if (reflection.trim()) window.localStorage.setItem(draftKey(session.id), reflection);
    else window.localStorage.removeItem(draftKey(session.id));
  }, [reflection, session]);

  const invalidateRoutine = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["home"] });
    qc.invalidateQueries({ queryKey: ["profile-stats"] });
    qc.invalidateQueries({ queryKey: ["journal"] });
  }, [qc]);

  const onStart = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { session: s, resumedExisting } = await start({ data: {} });
      haptics.tap();
      setSession(s);
      setElapsed(elapsedFor(s));
      setUi("active");
      setStatus("Walk started");
      if (resumedExisting) toast("Resumed your open walk.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not start walk";
      if (msg.toLowerCase().includes("adult")) toast.error("Please confirm your age to start a walk.");
      else toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const finalizeWalk = useCallback(
    async (opts: { note?: string }) => {
      if (!session) return;
      setBusy(true);
      try {
        const completed = await complete({
          data: {
            id: session.id,
            reflectionNote: opts.note?.trim() || undefined,
          },
        });
        // Only clear the draft after server confirms.
        if (typeof window !== "undefined") window.localStorage.removeItem(draftKey(session.id));
        setSession(completed);
        setUi("finish");
        setStatus("Walk ended");
        haptics.tap();
        invalidateRoutine();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not end walk");
      } finally {
        setBusy(false);
      }
    },
    [complete, invalidateRoutine, session],
  );

  const onEnd = () => finalizeWalk({ note: reflection });

  const onSaveReflection = async () => {
    if (!session || busy) return;
    setBusy(true);
    try {
      await saveReflection({
        data: {
          id: session.id,
          moodAfter: moodAfter.trim() || undefined,
          reflectionNote: reflection.trim() || undefined,
        },
      });
      invalidateRoutine();
      toast.success("Walk saved. Today counts.");
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save reflection");
    } finally {
      setBusy(false);
    }
  };

  const doDiscard = async () => {
    if (!session || busy) return;
    setDiscardOpen(false);
    setBusy(true);
    try {
      await abandon({ data: { id: session.id } });
      if (typeof window !== "undefined") window.localStorage.removeItem(draftKey(session.id));
      invalidateRoutine();
      setSession(null);
      setReflection("");
      setMoodAfter("");
      setJournalOpen(false);
      setUi("ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not discard walk");
    } finally {
      setBusy(false);
    }
  };

  // -----------------------------
  // Loading / error
  // -----------------------------
  if (ui === "loading") {
    return (
      <main className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </main>
    );
  }

  if (ui === "error") {
    return (
      <main className="mx-auto max-w-md px-4 pb-24 pt-6 md:pt-10">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Solo walk
          </div>
          <h1 className="mt-1 font-serif text-2xl">Could not check your walk</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Something got in the way. Try again in a moment.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setLoadTick((n) => n + 1)}
              className="min-h-[44px] rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: "/" })}
              className="min-h-[44px] rounded-2xl bg-forest px-4 py-3 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
            >
              Return home
            </button>
          </div>
        </section>
      </main>
    );
  }

  // -----------------------------
  // Finish (already completed)
  // -----------------------------
  if (ui === "finish" && session) {
    return (
      <main className="mx-auto max-w-md px-4 pb-24 pt-6 md:pt-10">
        <VisuallyHiddenStatus text={status} />
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-border bg-card p-5 shadow-soft"
        >
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Solo walk
          </div>
          <h1 className="mt-1 font-serif text-2xl">
            You walked for {fmtMinutes(session.duration_seconds)}.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything below is optional.</p>

          <label htmlFor="mood-after" className="mt-5 block text-xs font-medium text-muted-foreground">
            How are you leaving?
          </label>
          <input
            id="mood-after"
            value={moodAfter}
            onChange={(e) => setMoodAfter(e.target.value)}
            placeholder="One word is enough"
            maxLength={64}
            className="mt-1 w-full min-h-[44px] rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-forest"
          />

          <label
            htmlFor="reflection-finish"
            className="mt-4 block text-xs font-medium text-muted-foreground"
          >
            {SOLO_WALK_REFLECTION_PROMPT}
          </label>
          <textarea
            id="reflection-finish"
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            rows={4}
            maxLength={20000}
            placeholder="A sentence, a noticing, or leave blank."
            className="mt-1 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-forest"
          />

          <button
            type="button"
            onClick={onSaveReflection}
            disabled={busy}
            className="mt-5 inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-forest px-4 py-3 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? "Saving…" : "Save & close"}
          </button>
        </motion.section>
      </main>
    );
  }

  // -----------------------------
  // Active + Timed out (share layout)
  // -----------------------------
  if ((ui === "active" || ui === "timed_out") && session) {
    const timedOut = ui === "timed_out";
    const displaySeconds = timedOut ? SOLO_WALK_MAX_SECONDS : elapsed;
    return (
      <main className="mx-auto max-w-md px-4 pb-40 pt-6 md:pt-10">
        <VisuallyHiddenStatus text={status} />
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-accent/40 p-5 shadow-soft"
        >
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {timedOut ? "Timer stopped" : "Walking"}
          </div>
          <div
            aria-live="off"
            className="mt-1 font-serif text-5xl tabular-nums tracking-tight"
          >
            {fmtElapsed(displaySeconds)}
          </div>
          {timedOut ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Solo Walk timers stop after four hours so a forgotten timer cannot keep running.
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">A short walk still counts.</p>
          )}
        </motion.section>

        <section className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-soft">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Radio
          </div>
          <RadioActiveStrip />
          <div className="mt-3">
            <RadioQuickPicker />
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Journal
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Write down anything you want to keep.
              </p>
            </div>
            {!journalOpen ? (
              <button
                type="button"
                onClick={() => setJournalOpen(true)}
                aria-expanded={false}
                aria-controls="journal-panel"
                className="min-h-[44px] rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
              >
                Write a note
              </button>
            ) : null}
          </div>
          {journalOpen ? (
            <div id="journal-panel" aria-expanded={true}>
              <label
                htmlFor="reflection-active"
                className="mt-4 block text-xs font-medium text-muted-foreground"
              >
                {SOLO_WALK_REFLECTION_PROMPT}
              </label>
              <textarea
                id="reflection-active"
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                rows={4}
                maxLength={20000}
                placeholder="A sentence, a noticing, or leave blank."
                className="mt-1 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-forest"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Saved privately on this device while you walk.
              </p>
            </div>
          ) : null}
        </section>

        {/* Sticky end/discard action, sits above tab bar + dock */}
        <div
          className="sticky bottom-24 mt-6 rounded-2xl border border-border bg-card/95 p-3 shadow-soft backdrop-blur"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          {timedOut ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDiscardOpen(true)}
                disabled={busy}
                className="min-h-[44px] rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-accent/40 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={onEnd}
                disabled={busy}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-forest px-4 py-3 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {busy ? "Ending…" : "Finish walk"}
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={onEnd}
                disabled={busy}
                className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-forest px-4 py-3 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {busy ? "Ending…" : "End walk"}
              </button>
              <div className="mt-2 text-center">
                <button
                  type="button"
                  onClick={() => setDiscardOpen(true)}
                  disabled={busy}
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
                >
                  Discard walk
                </button>
              </div>
            </>
          )}
        </div>

        <DiscardDialog open={discardOpen} onOpenChange={setDiscardOpen} onConfirm={doDiscard} />
      </main>
    );
  }

  // -----------------------------
  // Ready
  // -----------------------------
  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-6 md:pt-10">
      <VisuallyHiddenStatus text={status} />
      <motion.section
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-border bg-card p-5 shadow-soft"
      >
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Solo walk
        </div>
        <h1 className="mt-1 font-serif text-2xl">A private walk for your own routine.</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          No route tracking. No pressure. A short walk still counts.
        </p>

        <button
          type="button"
          onClick={onStart}
          disabled={busy}
          className="mt-5 inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-forest px-4 py-3 text-base font-medium text-primary-foreground shadow-soft hover:opacity-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
        >
          <Footprints className="h-5 w-5" aria-hidden />
          {busy ? "Starting…" : "Start walking"}
        </button>
      </motion.section>

      <section className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Radio — optional
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Something gentle for the walk.</p>
        <div className="mt-3">
          <RadioQuickPicker />
        </div>
      </section>
    </main>
  );
}

// -------------------------------------------------------------
// Sub-components
// -------------------------------------------------------------

function VisuallyHiddenStatus({ text }: { text: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="sr-only"
    >
      {text}
    </div>
  );
}

/**
 * Shows a compact "now playing" strip only when the current shared audio is a
 * Radio track. Reuses the global player; never introduces a second audio
 * element. Missing/absent radio audio simply hides the strip.
 */
function RadioActiveStrip() {
  const player = usePlayer();
  const current = player.current;
  const isRadio = !!current && typeof current.id === "string" && current.id.startsWith("radio:");
  if (!isRadio || !current) return null;
  return (
    <div className="mt-2 flex items-center gap-3 rounded-2xl border border-border bg-background/70 p-3">
      <RadioIcon className="h-4 w-4 shrink-0 text-forest" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{current.title}</div>
        {current.subtitle ? (
          <div className="truncate text-xs text-muted-foreground">{current.subtitle}</div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => player.toggle()}
        aria-pressed={player.playing}
        aria-label={player.playing ? "Pause radio" : "Play radio"}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
      >
        {player.loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : player.playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

function DiscardDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard this walk?</AlertDialogTitle>
          <AlertDialogDescription>
            It will not count toward your routine. Your private note will also be removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep walking</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Discard</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
