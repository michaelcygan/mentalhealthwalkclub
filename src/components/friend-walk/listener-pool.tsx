import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Hand, Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toggleRaiseHand, promoteToSpeaker } from "@/lib/friend-walk.functions";
import { haptics } from "@/lib/device";
import { toast } from "sonner";

interface Participant {
  user_id: string;
  participant_role: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Props {
  roomId: string;
  isHost: boolean;
}

export function ListenerPool({ roomId, isHost }: Props) {
  const { user } = useAuth();
  const raise = useServerFn(toggleRaiseHand);
  const promote = useServerFn(promoteToSpeaker);
  const [people, setPeople] = useState<Participant[]>([]);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("audio_room_participants")
        .select("user_id, participant_role, profiles:profiles!audio_room_participants_user_id_fkey(display_name, avatar_url)")
        .eq("audio_room_id", roomId)
        .eq("status", "active");
      if (cancelled || !data) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (data as any[]).map((r) => ({
        user_id: r.user_id,
        participant_role: r.participant_role,
        display_name: r.profiles?.display_name ?? null,
        avatar_url: r.profiles?.avatar_url ?? null,
      })) as Participant[];
      // If FK join failed (no FK declared), fall back to a manual lookup
      if (rows.some((r) => r.display_name === null)) {
        const ids = rows.map((r) => r.user_id);
        const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
        const m = new Map((profs ?? []).map((p) => [p.id, p]));
        for (const r of rows) {
          const p = m.get(r.user_id);
          if (p) { r.display_name = p.display_name; r.avatar_url = p.avatar_url; }
        }
      }
      setPeople(rows);
    };
    load();
    const ch = supabase
      .channel(`friend-pool-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "audio_room_participants", filter: `audio_room_id=eq.${roomId}` }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [roomId]);

  const me = people.find((p) => p.user_id === user?.id);
  const listeners = people.filter((p) => p.participant_role === "listener" || p.participant_role === "raised_hand");
  const raised = people.filter((p) => p.participant_role === "raised_hand");

  if (!me || me.participant_role === "speaker") {
    // Host / speaker view: show pool + raised hands to admit
    if (listeners.length === 0) return null;
    return (
      <div className="rounded-2xl border border-border bg-card/70 p-3">
        <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>{listeners.length} listening</span>
          {raised.length > 0 && <span className="text-clay">{raised.length} raised hand</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {listeners.map((p) => (
            <button
              key={p.user_id}
              onClick={() => {
                if (!isHost) return;
                haptics.soft();
                promote({ data: { roomId, userId: p.user_id } }).then(() => toast(`${p.display_name ?? "walker"} is now speaking`));
              }}
              className={`group relative flex flex-col items-center gap-1 rounded-xl p-1.5 transition ${
                isHost && p.participant_role === "raised_hand" ? "bg-clay/15 hover:bg-clay/25" : ""
              }`}
              aria-label={isHost ? `Promote ${p.display_name ?? "walker"} to speaker` : (p.display_name ?? "listener")}
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={p.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px]">{(p.display_name ?? "?")[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              {p.participant_role === "raised_hand" && (
                <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-clay text-primary-foreground shadow">
                  <Hand className="h-3 w-3" />
                </span>
              )}
              <span className="max-w-[60px] truncate text-[10px] text-muted-foreground">{p.display_name ?? "walker"}</span>
            </button>
          ))}
        </div>
        {isHost && raised.length > 0 && (
          <p className="mt-2 text-[10px] text-muted-foreground">tap a raised hand to bring them on the mic</p>
        )}
      </div>
    );
  }

  // Listener self-view
  const isRaised = me.participant_role === "raised_hand";
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-serif text-base">You're listening in</div>
          <div className="text-xs text-muted-foreground">Up to 4 walkers can speak. Raise your hand to join the mic.</div>
        </div>
        <button
          onClick={() => {
            haptics.tap();
            raise({ data: { roomId, raised: !isRaised } }).then(() => toast(isRaised ? "hand lowered" : "hand raised — host will let you in"));
          }}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition ${
            isRaised ? "bg-clay text-primary-foreground" : "border border-border bg-background hover:border-forest/40"
          }`}
        >
          {isRaised ? <><Mic className="h-3.5 w-3.5" /> Waiting…</> : <><Hand className="h-3.5 w-3.5" /> Ask to speak</>}
        </button>
      </div>
    </div>
  );
}
