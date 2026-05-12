import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAuthPrompt } from "@/lib/auth-prompt";
import { useAmbient } from "@/lib/ambient-context";
import { haptics } from "@/lib/device";
import { createFriendWalk } from "@/lib/friend-walk.functions";
import { FriendWalkScheduleSheet } from "@/components/friend-walk/schedule-sheet";
import { FriendWalkShareCard } from "@/components/friend-walk/share-card";
import { WalkComposerSheet } from "./walk-composer";
import type { GuidedTrack } from "@/components/guide-picker";

export type WalkType = "solo" | "guided_solo" | "irl_event" | "audio";

type OpenOpts = { type?: WalkType };

type Ctx = {
  open: (opts?: OpenOpts) => void;
  close: () => void;
  startFriendWalk: () => void;
  openSchedule: () => void;
};

const WalkComposerCtx = createContext<Ctx | null>(null);

export function useWalkComposer(): Ctx {
  const ctx = useContext(WalkComposerCtx);
  if (!ctx) throw new Error("useWalkComposer must be used within <WalkComposerProvider>");
  return ctx;
}

export function WalkComposerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { requireAuth } = useAuthPrompt();
  const ambient = useAmbient();
  const navigate = useNavigate();
  const beganWalkRef = useRef(false);

  // Composer state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickGuide, setPickGuide] = useState(false);
  const [walkType, setWalkType] = useState<WalkType>("solo");
  const [feeling, setFeeling] = useState<string>("");
  const [moodScore, setMoodScore] = useState<number | null>(null);
  const [intention, setIntention] = useState("");
  const [busy, setBusy] = useState(false);

  // Friend walk state
  const createFriend = useServerFn(createFriendWalk);
  const [shareOpen, setShareOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [friendInfo, setFriendInfo] = useState<{ code: string; walkId: string | null; startsAt: string | null } | null>(null);
  const [friendBusy, setFriendBusy] = useState(false);

  const open = useCallback((opts?: OpenOpts) => {
    requireAuth(() => {
      haptics.soft();
      setWalkType(opts?.type ?? "solo");
      setPickGuide(false);
      beganWalkRef.current = false;
      setSheetOpen(true);
      if ((opts?.type ?? "solo") !== "audio") void ambient.start();
    });
  }, [ambient, requireAuth]);

  const close = useCallback(() => setSheetOpen(false), []);

  const handleSheetChange = useCallback((v: boolean) => {
    setSheetOpen(v);
    if (!v) {
      setPickGuide(false);
      if (!beganWalkRef.current) ambient.stop(600);
    }
  }, [ambient]);

  const beginWalk = useCallback(async (track?: GuidedTrack | null) => {
    if (!user) return;
    setBusy(true);
    try {
      const isPodcast = !!track?.podcast_episode_id;
      const { data, error } = await supabase.from("walk_sessions").insert({
        user_id: user.id,
        walk_type: walkType,
        status: "active",
        mood_before: feeling || null,
        mood_before_score: moodScore,
        intention: intention || null,
        guided_track_id: isPodcast ? null : (track?.id ?? null),
        podcast_episode_id: isPodcast ? track!.podcast_episode_id! : null,
      }).select("id").single();
      if (error) throw error;
      const ownsAudio = walkType === "audio" || (walkType === "guided_solo" && (track?.id || isPodcast));
      if (ownsAudio) ambient.stop(400);
      beganWalkRef.current = true;
      setSheetOpen(false);
      navigate({ to: "/walk/active/$id" as never, params: { id: data.id } as never });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start walk");
    } finally {
      setBusy(false);
    }
  }, [ambient, feeling, intention, moodScore, navigate, user, walkType]);

  const proceed = useCallback(() => {
    if (walkType === "guided_solo") setPickGuide(true);
    else void beginWalk();
  }, [walkType, beginWalk]);

  const startFriendWalk = useCallback(() => {
    requireAuth(async () => {
      setFriendBusy(true);
      try {
        const r = await createFriend();
        setFriendInfo({ code: r.code, walkId: r.walkId, startsAt: null });
        setSheetOpen(false);
        setShareOpen(true);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "couldn't start walk");
      } finally {
        setFriendBusy(false);
      }
    });
  }, [createFriend, requireAuth]);

  const openSchedule = useCallback(() => {
    requireAuth(() => {
      setSheetOpen(false);
      setScheduleOpen(true);
    });
  }, [requireAuth]);

  const value = useMemo<Ctx>(() => ({ open, close, startFriendWalk, openSchedule }), [open, close, startFriendWalk, openSchedule]);

  return (
    <WalkComposerCtx.Provider value={value}>
      {children}

      <WalkComposerSheet
        open={sheetOpen}
        onOpenChange={handleSheetChange}
        walkType={walkType}
        setWalkType={setWalkType}
        feeling={feeling}
        setFeeling={setFeeling}
        moodScore={moodScore}
        setMoodScore={setMoodScore}
        intention={intention}
        setIntention={setIntention}
        busy={busy}
        pickGuide={pickGuide}
        onProceed={proceed}
        onChooseTrack={(t) => beginWalk(t)}
        onSkipGuide={() => beginWalk(null)}
        friendBusy={friendBusy}
        onFriendWalk={startFriendWalk}
        onScheduleFriendWalk={openSchedule}
      />

      <FriendWalkScheduleSheet
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onScheduled={(info) => {
          setFriendInfo({ code: info.code, walkId: null, startsAt: info.startsAt });
          setShareOpen(true);
        }}
      />

      {friendInfo && (
        <FriendWalkShareCard
          open={shareOpen}
          onOpenChange={(v) => {
            setShareOpen(v);
            if (!v && friendInfo) {
              if (friendInfo.walkId) {
                navigate({ to: "/walk/active/$id" as never, params: { id: friendInfo.walkId } as never });
              }
              setFriendInfo(null);
            }
          }}
          hostName={user?.user_metadata?.display_name || user?.email?.split("@")[0] || "you"}
          hostAvatarUrl={user?.user_metadata?.avatar_url ?? null}
          shareCode={friendInfo.code}
          startsAt={friendInfo.startsAt}
        />
      )}
    </WalkComposerCtx.Provider>
  );
}
