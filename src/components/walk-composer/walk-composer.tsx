import { useNavigate } from "@tanstack/react-router";
import { Footprints, Headphones, MapPin, Sparkles, Heart, CalendarClock, DownloadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { MoodCloud, WeightBar } from "@/components/mood-cloud";
import { GuidePicker, type GuidedTrack } from "@/components/guide-picker";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { haptics } from "@/lib/device";
import { toast } from "sonner";
import type { WalkType } from "./use-walk-composer";

const MODE_PREFACE: Record<string, string> = {
  solo: "Walking alone still counts.",
  guided_solo: "A gentle voice in your ear.",
  audio: "You'll be matched once you start moving.",
  irl_event: "Real people, real sidewalks.",
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  walkType: WalkType;
  setWalkType: (t: WalkType) => void;
  feeling: string;
  setFeeling: (v: string) => void;
  moodScore: number | null;
  setMoodScore: (n: number | null) => void;
  intention: string;
  setIntention: (v: string) => void;
  busy: boolean;
  pickGuide: boolean;
  onProceed: () => void;
  onChooseTrack: (t: GuidedTrack) => void;
  onSkipGuide: () => void;
  friendBusy: boolean;
  onFriendWalk: () => void;
  onScheduleFriendWalk: () => void;
};

const MODES: Array<{ t: WalkType; icon: typeof Footprints; label: string; body: string }> = [
  { t: "solo", icon: Footprints, label: "Solo", body: "Just me & the steps" },
  { t: "audio", icon: Headphones, label: "Walk & Talk", body: "Match into a live pod" },
  { t: "guided_solo", icon: Sparkles, label: "Guided", body: "A voice in your ear" },
];

export function WalkComposerSheet({
  open, onOpenChange, walkType, setWalkType, feeling, setFeeling, moodScore, setMoodScore,
  intention, setIntention, busy, pickGuide, onProceed, onChooseTrack, onSkipGuide,
  friendBusy, onFriendWalk, onScheduleFriendWalk,
}: Props) {
  const kbInset = useKeyboardInset();
  const navigate = useNavigate();
  const pwa = usePwaInstall();

  const goLocal = () => {
    haptics.tap();
    onOpenChange(false);
    navigate({ to: "/events" as never });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-1 text-left">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-forest/80">Start a walk</div>
          <DrawerTitle className="mt-1 font-serif text-2xl text-balance">Choose how you want to walk</DrawerTitle>
          <p className="mt-1 text-sm italic text-muted-foreground">{MODE_PREFACE[walkType]}</p>
        </DrawerHeader>

        {pickGuide ? (
          <div className="px-4 pb-6">
            <GuidePicker mood={feeling || null} onChoose={onChooseTrack} onSkip={onSkipGuide} />
          </div>
        ) : (
          <>
            <div className="space-y-5 overflow-y-auto px-4 pb-3">
              {/* Mode tiles — 2-col, spacious, circle icons */}
              <div className="grid grid-cols-2 gap-3">
                {MODES.map(({ t, icon: Icon, label, body }) => {
                  const active = walkType === t;
                  return (
                    <button
                      key={t}
                      onClick={() => { setWalkType(t); haptics.tap(); }}
                      className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition active:scale-[0.98] ${
                        active
                          ? "border-forest bg-accent/60 ring-2 ring-forest/30 shadow-soft"
                          : "border-border bg-card hover:border-forest/40"
                      }`}
                    >
                      <span className={`grid h-9 w-9 place-items-center rounded-full ${active ? "bg-forest/15" : "bg-accent/60"}`}>
                        <Icon className={`h-4 w-4 ${active ? "text-forest" : "text-forest/80"}`} />
                      </span>
                      <span className={`font-serif text-base ${active ? "text-forest" : "text-foreground"}`}>{label}</span>
                      <span className="text-[11px] leading-tight text-muted-foreground">{body}</span>
                    </button>
                  );
                })}
                <button
                  onClick={goLocal}
                  className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4 text-left transition active:scale-[0.98] hover:border-forest/40"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-accent/60">
                    <MapPin className="h-4 w-4 text-forest/80" />
                  </span>
                  <span className="font-serif text-base">Local Walk</span>
                  <span className="text-[11px] leading-tight text-muted-foreground">Real sidewalks nearby</span>
                </button>
              </div>

              {/* Friend Walk row */}
              <button
                type="button"
                onClick={() => { haptics.tap(); onFriendWalk(); }}
                disabled={friendBusy}
                className="flex w-full items-center gap-3 rounded-2xl border border-clay/40 bg-gradient-to-br from-clay/15 to-cream/30 p-4 text-left transition active:scale-[0.98] hover:border-clay/60 disabled:opacity-60"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-clay/20">
                  <Heart className="h-4 w-4 text-clay" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-serif text-base">Friend Walk · share a link</div>
                  <div className="text-[11px] text-muted-foreground">spin up a private room — drop the link in your story</div>
                </div>
                <span className="rounded-full bg-clay/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-clay">new</span>
              </button>

              {/* Schedule Friend Walk row */}
              <button
                type="button"
                onClick={() => { haptics.tap(); onScheduleFriendWalk(); }}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition active:scale-[0.98] hover:border-forest/40"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/60">
                  <CalendarClock className="h-4 w-4 text-forest" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-serif text-base">Schedule a Friend Walk</div>
                  <div className="text-[11px] text-muted-foreground">pick a time later this week — share the invite now</div>
                </div>
              </button>

              {pwa.canInstall && (
                <button
                  type="button"
                  onClick={async () => {
                    haptics.tap();
                    const ok = await pwa.install();
                    if (ok) { onOpenChange(false); toast("Added to your home screen"); }
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-forest/30 bg-accent/20 p-3 text-left transition active:scale-[0.98] hover:border-forest/50"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest/15">
                    <DownloadCloud className="h-4 w-4 text-forest" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-sm">Add to home screen</div>
                    <div className="text-[11px] text-muted-foreground">one-tap launch, no app store</div>
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-forest">Install</span>
                </button>
              )}

              <MoodCloud value={feeling} onChange={setFeeling} />

              <div className={`transition-all duration-500 ${feeling ? "max-h-40 opacity-100" : "max-h-0 overflow-hidden opacity-0"}`}>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  How heavy does it feel? <span className="lowercase italic tracking-normal text-muted-foreground/70">(optional)</span>
                </p>
                <WeightBar value={moodScore} onChange={setMoodScore} />
              </div>

              <div className={`transition-all duration-500 ${moodScore ? "max-h-60 opacity-100" : "max-h-0 overflow-hidden opacity-0"}`}>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  An intention? <span className="lowercase italic tracking-normal text-muted-foreground/70">optional</span>
                </p>
                <textarea
                  value={intention}
                  onChange={(e) => setIntention(e.target.value)}
                  placeholder="e.g. let my shoulders drop"
                  rows={2}
                  className="w-full rounded-2xl border border-border bg-card p-3 text-sm focus:border-forest focus:outline-none"
                />
              </div>
            </div>

            <div
              className="border-t border-border glass px-4 pt-3"
              style={{ paddingBottom: `calc(max(env(safe-area-inset-bottom), 0.75rem) + ${kbInset}px)` }}
            >
              <Button onClick={onProceed} disabled={busy} className="h-14 w-full rounded-2xl bg-forest text-base text-primary-foreground hover:opacity-90">
                {busy ? "Starting…" : walkType === "guided_solo" ? "Choose a guide" : "Begin walking"}
              </Button>
              <button onClick={onProceed} className="mt-2 block w-full text-center text-xs italic text-muted-foreground hover:text-forest">
                skip the rest, just walk
              </button>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
