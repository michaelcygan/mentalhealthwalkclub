import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { facilitatorPrompts, type PromptStage } from "@/lib/facilitator-prompts";
import { haptics } from "@/lib/device";

interface Props {
  /** Seconds elapsed in the visit so we can pick the right prompt stage. */
  elapsedSeconds: number;
  /** Total visit length in seconds. */
  totalSeconds: number;
  /** Pause whispers (e.g. while report dialog is open). */
  paused?: boolean;
}

const WHISPER_INTERVAL = 90_000;

function pickStage(elapsed: number, total: number): PromptStage {
  const ratio = total > 0 ? elapsed / total : 0;
  if (elapsed < 30) return "openers";
  if (ratio > 0.75) return "wrap";
  if (ratio > 0.4) return "deepening";
  return "gentle";
}

/**
 * Surfaces one therapeutic prompt at a time as a soft toast — never more than
 * once every 90 seconds, never two on screen at once. Replaces the manual
 * drawer so facilitators stay present, not menu-driving.
 */
export function WhisperPrompts({ elapsedSeconds, totalSeconds, paused }: Props) {
  const lastShownRef = useRef(0);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (paused) return;
    const now = Date.now();
    if (now - lastShownRef.current < WHISPER_INTERVAL) return;

    const stage = pickStage(elapsedSeconds, totalSeconds);
    const pool = facilitatorPrompts[stage].filter((p) => !seenRef.current.has(p));
    const choice = (pool.length > 0 ? pool : facilitatorPrompts[stage])[
      Math.floor(Math.random() * (pool.length > 0 ? pool.length : facilitatorPrompts[stage].length))
    ];
    if (!choice) return;

    seenRef.current.add(choice);
    lastShownRef.current = now;

    toast(`"${choice}"`, {
      icon: <Sparkles className="h-4 w-4 text-forest" />,
      duration: 12_000,
      className: "font-serif italic",
      description: `whisper · ${stage}`,
    });
    haptics.tap();
  }, [elapsedSeconds, totalSeconds, paused]);

  return null;
}
