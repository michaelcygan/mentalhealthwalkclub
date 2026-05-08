import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { haptics } from "@/lib/device";
import { Heart } from "lucide-react";

/** Soft welcome-back card if last completed walk was >7d ago. No shame, no red. */
export function ComebackNudge({ userId, onStart }: { userId: string; onStart: () => void }) {
  const [show, setShow] = useState(false);
  const [days, setDays] = useState<number>(0);

  useEffect(() => {
    supabase
      .from("walk_sessions")
      .select("started_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const d = Math.floor((Date.now() - new Date(data.started_at).getTime()) / 86400000);
        if (d > 7) {
          setDays(d);
          setShow(true);
          haptics.tap();
        }
      });
  }, [userId]);

  if (!show) return null;

  return (
    <button
      onClick={() => { haptics.soft(); onStart(); }}
      className="flex w-full items-center gap-3 rounded-2xl border border-clay/40 bg-gradient-to-br from-cream/60 to-card p-4 text-left transition active:scale-[0.99]"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-clay/20">
        <Heart className="h-4 w-4 text-clay" />
      </span>
      <div className="flex-1">
        <div className="text-[10px] font-medium uppercase tracking-wider text-clay">Welcome back</div>
        <div className="font-serif text-base leading-snug">
          {days} days is a long week. Two minutes still counts.
        </div>
      </div>
    </button>
  );
}
