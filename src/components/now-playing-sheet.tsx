import { useState, useEffect } from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { ChevronDown, Pause, Play, Loader2, Rewind, FastForward, SkipForward, Volume2, VolumeX, ListMusic, X, ExternalLink, Square, Trash2, Moon } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { usePlayer, type PlayableTrack } from "@/lib/player-context";
import { useAmbient } from "@/lib/ambient-context";
import { CoverThumb } from "@/components/listen/cover-thumb";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NowPlayingSheet({ open, onOpenChange }: Props) {
  const {
    current, playing, loading, position, duration, queue,
    toggle, seek, skipBy, skipNext, stop,
    play, removeFromQueue, clearQueue,
    sleepTimerRemainingMs, setSleepTimer,
  } = usePlayer();
  const { muted, toggleMute, volume, setVolume } = useAmbient();
  const reduceMotion = useReducedMotion();
  const [scrub, setScrub] = useState<number | null>(null);

  // Reset scrub if track changes
  useEffect(() => { setScrub(null); }, [current?.id]);

  if (!current) return null;

  const live = scrub ?? position;
  const total = Math.max(duration, current.duration_seconds ?? 0, 1);
  const pct = (live / total) * 100;

  const onScrubChange = (v: number[]) => setScrub(v[0]);
  const onScrubCommit = (v: number[]) => {
    seek(v[0]);
    setScrub(null);
  };

  return (
    <SheetPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <SheetPrimitive.Portal forceMount>
            <SheetPrimitive.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </SheetPrimitive.Overlay>
            <SheetPrimitive.Content
              asChild
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <motion.div
                className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[640px] rounded-t-[28px] border-t border-border bg-background shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.4)]"
                style={{ maxHeight: "90dvh", paddingBottom: "env(safe-area-inset-bottom)" }}
                initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
                animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
                transition={reduceMotion ? { duration: 0.15 } : { type: "spring", stiffness: 320, damping: 32 }}
                drag={reduceMotion ? false : "y"}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.4 }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 120 || info.velocity.y > 600) onOpenChange(false);
                }}
              >
                {/* Hidden title for a11y */}
                <SheetPrimitive.Title className="sr-only">Now playing</SheetPrimitive.Title>
                <SheetPrimitive.Description className="sr-only">
                  {current.title}
                </SheetPrimitive.Description>

                {/* Grab handle */}
                <div className="flex justify-center pt-2.5">
                  <div className="h-1.5 w-10 rounded-full bg-border" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2">
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    aria-label="Collapse"
                    className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-accent/40 hover:text-foreground"
                  >
                    <ChevronDown className="h-5 w-5" />
                  </button>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Now playing
                  </span>
                  <div className="flex items-center gap-1">
                    {current.link && (
                      <a
                        href={current.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open source"
                        className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-accent/40 hover:text-foreground"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => { stop(); onOpenChange(false); }}
                      aria-label="Stop playback"
                      className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Square className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="overflow-y-auto px-5 pb-5" style={{ maxHeight: "calc(90dvh - 64px)" }}>
                  {/* Cover */}
                  <div className="mx-auto mt-2 aspect-square w-[min(70vw,300px)] overflow-hidden rounded-3xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.45)]">
                    <CoverThumb src={current.cover ?? null} title={current.title} kind={current.kind} />
                  </div>

                  {/* Title */}
                  <div className="mt-5 text-center">
                    <h2 className="line-clamp-2 font-serif text-xl leading-tight text-foreground">{current.title}</h2>
                    {current.subtitle && (
                      <p className="mt-1 truncate text-sm text-muted-foreground">{current.subtitle}</p>
                    )}
                  </div>

                  {/* Scrubber */}
                  <div className="mt-6">
                    <Slider
                      value={[live]}
                      min={0}
                      max={total}
                      step={1}
                      onValueChange={onScrubChange}
                      onValueCommit={onScrubCommit}
                      aria-label="Scrub"
                    />
                    <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted-foreground">
                      <span>{formatTime(live)}</span>
                      <span>-{formatTime(Math.max(0, total - live))}</span>
                    </div>
                  </div>

                  {/* Transport */}
                  <div className="mt-5 flex items-center justify-center gap-7">
                    <button
                      type="button"
                      onClick={() => skipBy(-15)}
                      aria-label="Back 15 seconds"
                      className="grid h-12 w-12 place-items-center rounded-full text-foreground transition hover:bg-accent/40"
                    >
                      <Rewind className="h-6 w-6" />
                    </button>
                    <button
                      type="button"
                      onClick={toggle}
                      aria-label={playing ? "Pause" : "Play"}
                      className="grid h-16 w-16 place-items-center rounded-full bg-forest text-primary-foreground shadow-floating transition active:scale-95"
                    >
                      {loading ? (
                        <Loader2 className="h-7 w-7 animate-spin" />
                      ) : playing ? (
                        <Pause className="h-7 w-7" />
                      ) : (
                        <Play className="h-7 w-7 translate-x-0.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={skipNext}
                      disabled={queue.length === 0}
                      aria-label="Skip to next in queue"
                      className={cn(
                        "grid h-12 w-12 place-items-center rounded-full text-foreground transition",
                        queue.length === 0 ? "opacity-30" : "hover:bg-accent/40",
                      )}
                    >
                      <SkipForward className="h-6 w-6" />
                    </button>
                  </div>

                  {/* Secondary: skip forward 15 + volume */}
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => skipBy(15)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] text-muted-foreground transition hover:text-foreground"
                    >
                      <FastForward className="h-3.5 w-3.5" /> +15s
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // Cycle: off → 15 → 30 → 60 → off
                        const current = sleepTimerRemainingMs ? Math.ceil(sleepTimerRemainingMs / 60_000) : 0;
                        const nextMap: Record<number, number | null> = { 0: 15, 15: 30, 30: 60, 60: null };
                        // Map by nearest preset
                        const nearest = current >= 60 ? 60 : current >= 30 ? 30 : current >= 15 ? 15 : 0;
                        setSleepTimer(nextMap[nearest] ?? null);
                      }}
                      aria-label="Sleep timer"
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] transition",
                        sleepTimerRemainingMs
                          ? "border-forest/40 bg-forest/10 text-forest"
                          : "border-border bg-card text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Moon className="h-3.5 w-3.5" />
                      {sleepTimerRemainingMs
                        ? `${Math.ceil(sleepTimerRemainingMs / 60_000)}m`
                        : "Sleep"}
                    </button>
                    <div className="flex flex-1 items-center gap-2 pl-3">
                      <button
                        type="button"
                        onClick={toggleMute}
                        aria-label={muted ? "Unmute ambient" : "Mute ambient"}
                        className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:text-foreground"
                      >
                        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      </button>
                      <div className="hidden flex-1 md:block">
                        <Slider
                          value={[Math.round(volume * 100)]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={(v) => setVolume(v[0] / 100)}
                          aria-label="Ambient volume"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Queue */}
                  <div className="mt-7">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="flex items-center gap-1.5 font-serif text-sm text-foreground">
                        <ListMusic className="h-4 w-4 text-forest" /> Up next
                        {queue.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">· {queue.length}</span>
                        )}
                      </h3>
                      {queue.length > 0 && (
                        <button
                          type="button"
                          onClick={clearQueue}
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" /> Clear
                        </button>
                      )}
                    </div>
                    {queue.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-border bg-card/60 p-4 text-center text-[11px] text-muted-foreground">
                        Nothing queued. Tap "Add to queue" on any episode to line it up.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {queue.map((t, i) => (
                          <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5">
                            <span className="w-4 shrink-0 text-center text-[11px] tabular-nums text-muted-foreground">{i + 1}</span>
                            <button
                              type="button"
                              onClick={() => {
                                removeFromQueue(t.id);
                                play(t);
                              }}
                              className="flex min-w-0 flex-1 items-center gap-3 text-left"
                              aria-label={`Play ${t.title} now`}
                            >
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                                <CoverThumb src={t.cover ?? null} title={t.title} kind={t.kind} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-1 font-serif text-xs leading-tight">{t.title}</p>
                                {t.subtitle && (
                                  <p className="truncate text-[10px] text-muted-foreground">{t.subtitle}</p>
                                )}
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeFromQueue(t.id)}
                              aria-label="Remove from queue"
                              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </motion.div>
            </SheetPrimitive.Content>
          </SheetPrimitive.Portal>
        )}
      </AnimatePresence>
    </SheetPrimitive.Root>
  );
}

// Re-export the type so consumers can reference if needed.
export type { PlayableTrack };
