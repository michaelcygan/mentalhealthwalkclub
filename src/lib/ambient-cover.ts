import backyardCover from "@/assets/backyard-thumbnail.png.asset.json";
import { resolveCover } from "@/lib/cover-url";
import type { AmbientTrack } from "@/lib/ambient-context";

export function ambientCover(track: AmbientTrack | null | undefined): string | null {
  if (!track) return null;
  if (track.title.trim().toLowerCase() === "backyard") return backyardCover.url;
  return resolveCover(track.cover_path);
}