import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { usePlayer, type PlayableTrack } from "@/lib/player-context";
import { useAmbient } from "@/lib/ambient-context";
import { logListenEvent } from "@/lib/listen-search.functions";

export type PlayableItem = {
  kind: "podcast" | "ambient" | "guided" | "blog";
  id: string;
  title: string;
  subtitle?: string | null;
  cover?: string | null;
  audio_url?: string | null;
  link?: string | null;
  duration_seconds?: number | null;
};

/**
 * Returns a single click handler used by every Listen surface so behavior is
 * consistent: podcast/guided → play in foreground player, ambient → start
 * ambient mixes, blog → open article in new tab. Items with no playable URL
 * fall back to opening the source link.
 */
export function usePlayOrOpen() {
  const { play } = usePlayer();
  const ambient = useAmbient();
  const log = useServerFn(logListenEvent);

  return useCallback(
    (item: PlayableItem) => {
      try {
        if (item.kind === "blog") {
          if (item.link) {
            window.open(item.link, "_blank", "noopener,noreferrer");
            log({ data: { kind: "blog", item_id: item.id, action: "open" } }).catch(() => {});
          } else toast.error("No link available.");
          return;
        }
        if (item.kind === "ambient") {
          ambient.start();
          log({ data: { kind: "ambient", item_id: item.id, action: "play" } }).catch(() => {});
          return;
        }
        // podcast or guided
        if (!item.audio_url) {
          if (item.link) {
            window.open(item.link, "_blank", "noopener,noreferrer");
            return;
          }
          toast.error("No audio available for this episode.");
          return;
        }
        const track: PlayableTrack = {
          id: item.id,
          kind: item.kind,
          title: item.title,
          subtitle: item.subtitle ?? null,
          cover: item.cover ?? null,
          audio_url: item.audio_url,
          link: item.link ?? null,
          duration_seconds: item.duration_seconds ?? null,
        };
        play(track);
        log({ data: { kind: item.kind, item_id: item.id, action: "play" } }).catch(() => {});
      } catch {
        toast.error("Couldn't open this item.");
      }
    },
    [play, ambient, log],
  );
}
