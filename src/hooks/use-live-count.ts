import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInterval } from "@/hooks/use-interval";

/** Total walkers across all open audio rooms. Polls every 45s, pauses when hidden. */
export function useLiveCount(roomType?: "friend" | "open") {
  const [count, setCount] = useState(0);

  const load = () => {
    let q = supabase
      .from("audio_rooms")
      .select("current_participant_count")
      .eq("status", "open")
      .gt("current_participant_count", 0);
    if (roomType) q = q.eq("room_type", roomType);
    q.then(({ data }) =>
      setCount((data ?? []).reduce((s, r) => s + (r.current_participant_count ?? 0), 0))
    );
  };

  useEffect(load, [roomType]); // eslint-disable-line react-hooks/exhaustive-deps
  useInterval(load, 45_000);

  return count;
}
