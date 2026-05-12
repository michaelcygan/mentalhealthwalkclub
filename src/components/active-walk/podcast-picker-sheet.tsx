/**
 * In-walk podcast picker — wraps PodcastBrowser in a Drawer and
 * persists the chosen episode onto the active walk session.
 */
import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { PodcastBrowser, type GuidedTrack } from "@/components/guide-picker";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { haptics } from "@/lib/device";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  walkSessionId: string;
  mood: string | null;
  onPicked: (episodeId: string) => void;
}

export function PodcastPickerSheet({ open, onOpenChange, walkSessionId, mood, onPicked }: Props) {
  const [busy, setBusy] = useState(false);

  const handleChoose = async (t: GuidedTrack) => {
    if (!t.podcast_episode_id || busy) return;
    setBusy(true);
    haptics.tap();
    const { error } = await supabase
      .from("walk_sessions")
      .update({ podcast_episode_id: t.podcast_episode_id, guided_track_id: null })
      .eq("id", walkSessionId);
    setBusy(false);
    if (error) {
      toast.error("Couldn't add the podcast");
      return;
    }
    onPicked(t.podcast_episode_id);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88vh]">
        <DrawerHeader className="pb-1 text-left">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-forest/80">For your walk</div>
          <DrawerTitle className="mt-1 font-serif text-2xl">Pick a podcast</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-8">
          <PodcastBrowser mood={mood} onChoose={handleChoose} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
