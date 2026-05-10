/**
 * Walk & Talk module — wraps the audio dock and (when a friend room exists)
 * the listener pool + invite share button.
 */
import { Share2 } from "lucide-react";
import { WalkTalkDock } from "@/components/walk-talk-dock";
import { ListenerPool } from "@/components/friend-walk/listener-pool";
import { SoloModule } from "./solo-module";

interface FriendRoom {
  id: string;
  share_code: string | null;
  host_user_id: string | null;
}

interface Props {
  walkSessionId: string;
  mood: string | null;
  hasMoved: boolean;
  intention: string | null;
  savedPrompts: string[];
  onSavePrompt: (text: string) => void;
  friendRoom: FriendRoom | null;
  currentUserId: string | null;
  onInvite: () => void;
}

export function WalkTalkModule({
  walkSessionId,
  mood,
  hasMoved,
  intention,
  savedPrompts,
  onSavePrompt,
  friendRoom,
  currentUserId,
  onInvite,
}: Props) {
  return (
    <section className="space-y-3">
      <SoloModule intention={intention} savedPrompts={savedPrompts} />
      <WalkTalkDock
        walkSessionId={walkSessionId}
        mood={mood}
        hasMoved={hasMoved}
        onSavePrompt={onSavePrompt}
      />
      {friendRoom && (
        <>
          <ListenerPool roomId={friendRoom.id} isHost={friendRoom.host_user_id === currentUserId} />
          {friendRoom.share_code && (
            <button
              onClick={onInvite}
              className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-border bg-card px-3 py-3 text-sm font-medium text-foreground transition active:scale-[0.98]"
            >
              <Share2 className="h-4 w-4" /> Invite a friend
            </button>
          )}
        </>
      )}
    </section>
  );
}
