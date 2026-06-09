"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { haptics } from "@/lib/device";
import { quickRsvpEvent } from "@/lib/discover.functions";
import { toast } from "sonner";

interface Props {
  eventId: string;
  initialGoing?: boolean;
  onRsvp?: () => void;
}

export function RsvpPill({ eventId, initialGoing = false, onRsvp }: Props) {
  const [going, setGoing] = useState(initialGoing);
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy || going) return;
    haptics.tap();
    setBusy(true);
    setGoing(true);
    try {
      await quickRsvpEvent({ data: { eventId } });
      haptics.success();
      toast.success("You're in. We'll remind you 1 hour before.");
      onRsvp?.();
    } catch (e) {
      setGoing(false);
      toast.error(e instanceof Error ? e.message : "Could not RSVP.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={handleClick}
      disabled={busy || going}
      className={`relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
        going
          ? "bg-forest text-primary-foreground"
          : "border border-border bg-card text-foreground hover:bg-accent/40"
      }`}
    >
      {going ? (
        <>
          <Check className="h-3 w-3" />
          <span>Going</span>
        </>
      ) : (
        <span>I'm in</span>
      )}
    </motion.button>
  );
}
