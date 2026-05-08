import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyFriendWalks } from "@/lib/friend-walk.functions";
import { useAuth } from "@/lib/auth-context";

export interface FriendWalk {
  id: string;
  title: string;
  share_code: string | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  current_participant_count: number;
  created_at: string;
}

/** Shared loader for the user's own friend walks. */
export function useFriendWalks() {
  const { user } = useAuth();
  const list = useServerFn(listMyFriendWalks);
  const [walks, setWalks] = useState<FriendWalk[] | null>(null);

  const reload = useCallback(() => {
    if (!user) { setWalks([]); return; }
    list().then((r) => setWalks(r.walks as FriendWalk[])).catch(() => setWalks([]));
  }, [list, user]);

  useEffect(() => { reload(); }, [reload]);

  return { walks, reload };
}
