import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Footprints, X, PenLine, Radio as RadioIcon, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  abandonSoloWalk,
  completeSoloWalk,
  getActiveSoloWalk,
  startSoloWalk,
  type SoloWalkSession,
} from "@/lib/solo-walk.functions";
import { RadioQuickPicker } from "@/components/radio/radio-quick-picker";
import { haptics } from "@/lib/device";

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

type UIState = "loading" | "ready" | "active" | "finish" | "saved";

const STALE_HOURS = 12;

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

function WalkPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchActive = useServerFn(getActiveSoloWalk);
  const start = useServerFn(startSoloWalk);
  const complete = useServerFn(completeSoloWalk);
  const abandon = useServerFn(abandonSoloWalk);

  const [ui, setUi] = useState<UIState>("loading");
  const [session, setSession] = useState<SoloWalkSession | null>(null);
  const [moodBefore, setMoodBefore] = useState<string>("");
  const [intention, setIntention] = useState<string>("");
  const [reflection, setReflection] = useState<string>("");
  const [moodAfter, setMoodAfter] = useState<string>("");
  const [reflectOpen, setReflectOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const active = await fetchActive();
        if (cancelled) return;
        if (active) {
          setSession(active);
          setUi("active");
          const draft = typeof window !== "undefined" ? window.localStorage.getItem(draftKey(active.id)) : null;
          if (draft) setReflection(draft);
        } else {
          setUi("ready");
        }
      } catch {
        if (!cancelled) setUi("ready");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchActive]);

  // Live elapsed clock (display only; server owns duration)
  useEffect(() => {
    if (!session || session.status !== "active") return;
    const startedMs = new Date(session.started_at).getTime();
    const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - startedMs) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [session]);

  // Persist reflection draft
  useEffect(() => {
    if (!session || typeof window === "undefined") return;
    if (reflection.trim()) window.localStorage.setItem(draftKey(session.id), reflection);
    else window.localStorage.removeItem(draftKey(session.id));
  }, [reflection, session]);

  const isStale = useMemo(() => {
    if (!session || session.status !== "active") return false;
    const ageH = (Date.now() - new Date(session.started_at).getTime()) / 3_600_000;
    return ageH > STALE_HOURS;
  }, [session]);

  const invalidateRoutine = () => {
    qc.invalidateQueries({ queryKey: ["home"] });
    qc.invalidateQueries({ queryKey: ["profile-stats"] });
    qc.invalidateQueries({ queryKey: ["journal"] });
  };

  const onStart = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { session: s, resumedExisting } = await start({
        data: {
          moodBefore: moodBefore.trim() || undefined,
          intention: intention.trim() || undefined,
        },
      });
      haptics.tap();
      setSession(s);
      setUi("active");
      if (resumedExisting) toast("Resumed your open walk.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not start walk";
      if (msg.includes("adult")) toast.error("Please confirm your age to start a walk.");
      else toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const onEndClick = () => {
    if (!session) return;
    setUi("finish");
  };

  const onSave = async () => {
    if (!session || busy) return;
    setBusy(true);
    try {
      const updated = await complete({
        data: {
          id: session.id,
          moodAfter: moodAfter.trim() || undefined,
          reflectionNote: reflection.trim() || undefined,
        },
      });
      setSession(updated);
      if (typeof window !== "undefined") window.localStorage.removeItem(draftKey(session.id));
      invalidateRoutine();
      haptics.tap();
      setUi("saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save walk");
    } finally {
      setBusy(false);
    }
  };

  const onAbandon = async () => {
    if (!session || busy) return;
    if (!window.confirm("Discard this walk? It won't count toward your routine.")) return;
    setBusy(true);
    try {
      await abandon({ data: { id: session.id } });
      if (typeof window !== "undefined") window.localStorage.removeItem(draftKey(session.id));
      invalidateRoutine();
      setSession(null);
      setReflection("");
      setMoodAfter("");
      setUi("ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not discard walk");
    } finally {
      setBusy(false);
    }
  };

  if (ui === "loading") {
    return (
      <main className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (ui === "saved" && session) {
    return (
      <main className="mx-auto max-w-md px-4 pb-24 pt-6 md:pt-10">
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-border bg-card p-6 text-center shadow-soft"
        >
          <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-forest/10">
            <Check className="h-5 w-5 text-forest" />
          </div>
          <h1 className="font-serif text-2xl">Walk saved.</h1>
          <p className="mt-1 text-sm text-muted-foreground">Today counts.</p>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <Link
              to="/"
              className="rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-accent/40"
            >
              Back home
            </Link>
            <Link
              to="/journal"
              className="rounded-2xl bg-forest px-4 py-3 text-sm font-medium text-primary-foreground hover:opacity-95"
            >
              View journal
            </Link>
          </div>
        </motion.section>
      </main>
    );
  }

  if (ui === "finish" && session) {
    const duration = Math.max(0, Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000));
    return (
      <main className="mx-auto max-w-md px-4 pb-24 pt-6 md:pt-10">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Solo walk
          </div>
          <h1 className="mt-1 font-serif text-2xl">You walked for {fmtMinutes(duration)}.</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything below is optional.</p>

          <label className="mt-4 block text-xs font-medium text-muted-foreground">How are you leaving?</label>
          <input
            value={moodAfter}
            onChange={(e) => setMoodAfter(e.target.value)}
            placeholder="One word is enough"
            maxLength={64}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-forest"
          />

          <label className="mt-4 block text-xs font-medium text-muted-foreground">
            What is worth keeping?
          </label>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            rows={4}
            maxLength={20000}
            placeholder="A sentence, a noticing, or leave blank."
            className="mt-1 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-forest"
          />

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setUi("active")}
              disabled={busy}
              className="rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-accent/40 disabled:opacity-60"
            >
              Back
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-forest px-4 py-3 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-95 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? "Saving…" : "Save walk"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (ui === "active" && session) {
    return (
      <main className="mx-auto max-w-md px-4 pb-24 pt-6 md:pt-10">
        <section className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-accent/40 p-5 shadow-soft">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Walking
          </div>
          <div className="mt-1 font-serif text-5xl tabular-nums tracking-tight">{fmtElapsed(elapsed)}</div>
          {session.intention ? (
            <p className="mt-2 text-sm text-muted-foreground">"{session.intention}"</p>
          ) : null}

          {isStale ? (
            <div className="mt-4 rounded-xl border border-clay/30 bg-clay/10 p-3 text-sm">
              You still have an earlier Solo Walk open. Finish it or discard it below.
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setReflectOpen((v) => !v)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-accent/40"
            >
              <PenLine className="h-4 w-4" /> Reflect
            </button>
            <button
              type="button"
              onClick={onEndClick}
              className="rounded-2xl bg-forest px-4 py-3 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-95"
            >
              End walk
            </button>
          </div>

          {reflectOpen ? (
            <div className="mt-3">
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                rows={3}
                maxLength={20000}
                placeholder="A quiet noticing, saved with this walk."
                className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-forest"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Autosaves on this device.</p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onAbandon}
            disabled={busy}
            className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-60"
          >
            <X className="h-3 w-3" /> Discard walk
          </button>
        </section>
      </main>
    );
  }

  // ready
  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-6 md:pt-10">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Solo walk
        </div>
        <h1 className="mt-1 font-serif text-2xl">A private walk for your own routine.</h1>
        <p className="mt-1 text-sm text-muted-foreground">No route tracking. No pressure. A short walk still counts.</p>

        <button
          type="button"
          onClick={onStart}
          disabled={busy}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-forest px-4 py-3 text-base font-medium text-primary-foreground shadow-soft hover:opacity-95 disabled:opacity-60"
        >
          <Footprints className="h-5 w-5" />
          {busy ? "Starting…" : "Start walking"}
        </button>

        <details className="mt-5 group">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Optional
          </summary>
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground">
                How are you arriving?
              </label>
              <input
                value={moodBefore}
                onChange={(e) => setMoodBefore(e.target.value)}
                placeholder="One word is enough"
                maxLength={64}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-forest"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">
                Anything to carry with you?
              </label>
              <input
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                placeholder="A small intention"
                maxLength={240}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-forest"
              />
            </div>
          </div>
        </details>

        <div className="mt-6">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            <RadioIcon className="h-3.5 w-3.5" /> Walk with Radio
          </div>
          <RadioQuickPicker />
        </div>
      </section>
    </main>
  );
}
