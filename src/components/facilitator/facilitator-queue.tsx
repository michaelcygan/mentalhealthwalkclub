import { useEffect, useState } from "react";
import { Users, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PodPreview {
  id: string;
  title: string | null;
  participants: number;
  ageMinutes: number;
}

/**
 * Ghost queue: 3 most-likely-next pods so the facilitator feels routed, not
 * idle. Pure read of audio_rooms — no new server fn, no schema change.
 */
export function FacilitatorQueue() {
  const [pods, setPods] = useState<PodPreview[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("audio_rooms")
        .select("id,title,current_participant_count,opened_at,facilitator_user_id,status")
        .eq("status", "open")
        .is("facilitator_user_id", null)
        .gte("current_participant_count", 1)
        .order("current_participant_count", { ascending: false })
        .limit(3);
      if (cancelled) return;
      const now = Date.now();
      setPods(
        (data ?? []).map((r) => ({
          id: r.id,
          title: r.title,
          participants: r.current_participant_count ?? 0,
          ageMinutes: r.opened_at ? Math.max(0, Math.round((now - new Date(r.opened_at).getTime()) / 60_000)) : 0,
        })),
      );
    };
    load();
    const t = window.setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (pods === null) return null;
  if (pods.length === 0) {
    return (
      <p className="px-1 text-center text-[11px] italic text-muted-foreground">
        No pods need a facilitator right this minute.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Likely next</div>
      <ul className="space-y-1.5">
        {pods.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-3 py-2 text-xs"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-serif">{p.title ?? "Walk & Talk"}</div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Users className="h-2.5 w-2.5" />{p.participants}</span>
                <span className="inline-flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{p.ageMinutes}m</span>
              </div>
            </div>
            <span className="rounded-full bg-accent/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-forest/80">queued</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
