import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic, MicOff, LogOut, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAudioRoom } from "@/lib/audio/use-audio-room";
import { joinAudioRoom, leaveAudioRoom } from "@/server/audio.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

interface Props {
  roomId: string;
  walkSessionId: string;
  roomTitle: string;
  capacity: number;
  onLeave?: () => void;
}

export function AudioRoomPanel({ roomId, walkSessionId, roomTitle, capacity, onLeave }: Props) {
  const { user } = useAuth();
  const [admitted, setAdmitted] = useState(false);
  const [joining, setJoining] = useState(true);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, { display_name: string | null; avatar_url: string | null }>>({});

  const joinFn = useServerFn(joinAudioRoom);
  const leaveFn = useServerFn(leaveAudioRoom);

  useEffect(() => {
    let mounted = true;
    joinFn({ data: { roomId, walkSessionId } })
      .then(() => { if (mounted) { setAdmitted(true); setJoining(false); } })
      .catch((e: Error) => { if (mounted) { setJoinError(e.message); setJoining(false); } });
    return () => { mounted = false; };
  }, [roomId, walkSessionId, joinFn]);

  const { participants, status, error, muted, toggleMute, leave } = useAudioRoom(
    admitted ? roomId : null,
    user?.id ?? null,
    admitted,
  );

  // Fetch display names/avatars for participants
  const ids = useMemo(() => participants.map((p) => p.userId), [participants]);
  useEffect(() => {
    const missing = ids.filter((id) => !profiles[id]);
    if (missing.length === 0) return;
    supabase.from("profiles").select("id,display_name,avatar_url").in("id", missing).then(({ data }) => {
      if (!data) return;
      setProfiles((prev) => {
        const next = { ...prev };
        for (const p of data) next[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
        return next;
      });
    });
  }, [ids, profiles]);

  const handleLeave = async () => {
    await leave();
    await leaveFn({ data: { roomId } }).catch(() => {});
    toast.success("Left the Walk & Talk. Keep going.");
    onLeave?.();
  };

  if (joining) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-soft">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Joining {roomTitle}…
      </div>
    );
  }

  if (joinError) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm">
        <div className="mb-1 flex items-center gap-2 font-medium text-destructive"><AlertCircle className="h-4 w-4" />Couldn't join</div>
        <p className="text-foreground">{joinError}</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm">
        <div className="mb-1 flex items-center gap-2 font-medium text-destructive"><AlertCircle className="h-4 w-4" />Mic blocked</div>
        <p className="text-foreground">{error?.message ?? "Allow microphone access in your browser to join."}</p>
        <Button onClick={handleLeave} variant="outline" size="sm" className="mt-3 rounded-full">Leave walk</Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="font-serif text-lg">{roomTitle}</div>
          <div className="text-xs text-muted-foreground">
            {status === "connecting" || status === "requesting-mic" ? "Connecting…" : `${participants.length} of ${capacity} walking together`}
          </div>
        </div>
      </div>

      <ul className="mb-5 grid grid-cols-4 gap-3 sm:grid-cols-6">
        {participants.map((p) => {
          const profile = profiles[p.userId];
          const name = profile?.display_name ?? (p.userId === user?.id ? "You" : "Walker");
          const initial = (name?.[0] ?? "•").toUpperCase();
          return (
            <li key={p.userId} className="flex flex-col items-center gap-1.5">
              <div className={`relative grid h-12 w-12 place-items-center rounded-full border bg-secondary text-sm font-medium transition-shadow ${p.speaking ? "ring-2 ring-forest ring-offset-2 ring-offset-card" : ""}`}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  <span>{initial}</span>
                )}
                {p.muted && (
                  <div className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-muted-foreground text-background">
                    <MicOff className="h-3 w-3" />
                  </div>
                )}
              </div>
              <div className="max-w-[64px] truncate text-[11px] text-muted-foreground">{name}</div>
            </li>
          );
        })}
      </ul>

      <div className="flex gap-3">
        <Button onClick={toggleMute} variant={muted ? "outline" : "default"} className={`h-12 flex-1 rounded-2xl ${muted ? "" : "bg-forest text-primary-foreground hover:opacity-90"}`}>
          {muted ? <><MicOff className="mr-2 h-4 w-4" />Unmute</> : <><Mic className="mr-2 h-4 w-4" />Mute</>}
        </Button>
        <Button onClick={handleLeave} variant="outline" className="h-12 flex-1 rounded-2xl">
          <LogOut className="mr-2 h-4 w-4" />Leave audio
        </Button>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">Audio is peer-to-peer. Your walk continues even if you leave the room.</p>
    </div>
  );
}
