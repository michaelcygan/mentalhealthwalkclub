import { useAmbient } from "@/lib/ambient-context";
import { Music, Volume2, VolumeX, SkipForward } from "lucide-react";

/**
 * Walk-only now-playing pill. Shows the current ambient track with
 * mute/unmute and skip. Hides itself when there's no library or nothing playing.
 */
export function AmbientPill() {
  const { current, muted, toggleMute, skip, hasLibrary } = useAmbient();
  if (!hasLibrary || !current) return null;
  return (
    <div className="mx-auto flex max-w-md items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1.5 text-xs text-primary-foreground/90 backdrop-blur">
      <Music className={`h-3.5 w-3.5 shrink-0 ${muted ? "opacity-50" : "opacity-90"}`} />
      <div className="min-w-0 flex-1 truncate">
        <span className="font-medium">{current.title}</span>
        {current.artist && <span className="opacity-70"> — {current.artist}</span>}
      </div>
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Unmute music" : "Mute music"}
        className="rounded-full p-1.5 transition active:scale-95 hover:bg-primary-foreground/15"
      >
        {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        onClick={skip}
        aria-label="Next track"
        className="rounded-full p-1.5 transition active:scale-95 hover:bg-primary-foreground/15"
      >
        <SkipForward className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
