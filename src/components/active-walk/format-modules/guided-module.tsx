/**
 * Guided walk module — wraps the guided audio player.
 */
import { GuidedPlayer } from "@/components/guided-player";
import { SoloModule } from "./solo-module";

interface Props {
  trackId: string;
  paused: boolean;
  intention: string | null;
  savedPrompts: string[];
}

export function GuidedModule({ trackId, paused, intention, savedPrompts }: Props) {
  return (
    <section className="space-y-3">
      <SoloModule intention={intention} savedPrompts={savedPrompts} />
      <GuidedPlayer trackId={trackId} paused={paused} />
    </section>
  );
}
