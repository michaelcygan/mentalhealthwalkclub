import { MoreVertical, Play, Plus, ListPlus, ExternalLink } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePlayer, type PlayableTrack } from "@/lib/player-context";
import type { PlayableItem } from "@/lib/play-helpers";
import { usePlayOrOpen } from "@/lib/play-helpers";

interface Props {
  item: PlayableItem;
  /** Visual size of the trigger button. */
  size?: "sm" | "md";
}

/**
 * Kebab menu for any podcast/guided/blog tile. Provides Play now / Play next /
 * Add to queue / Open source. Ambient items have no queue affordance (they
 * play on the ambient loop), so this menu is for podcast/guided/blog only.
 */
export function TileActionsMenu({ item, size = "sm" }: Props) {
  const { enqueue, playNext } = usePlayer();
  const playOrOpen = usePlayOrOpen();

  if (item.kind === "ambient") return null;

  const toTrack = (): PlayableTrack | null => {
    if (item.kind !== "podcast" && item.kind !== "guided") return null;
    if (!item.audio_url) return null;
    return {
      id: item.id,
      kind: item.kind,
      title: item.title,
      subtitle: item.subtitle ?? null,
      cover: item.cover ?? null,
      audio_url: item.audio_url,
      link: item.link ?? null,
      duration_seconds: item.duration_seconds ?? null,
    };
  };

  const dim = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="More"
          onClick={(e) => e.stopPropagation()}
          className={`grid ${dim} place-items-center rounded-full bg-background/80 text-muted-foreground shadow-sm backdrop-blur transition hover:text-foreground`}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        onClick={(e) => e.stopPropagation()}
        className="w-48"
      >
        <DropdownMenuItem onSelect={() => playOrOpen(item)}>
          {item.kind === "blog" ? (
            <>
              <ExternalLink className="mr-2 h-4 w-4" /> Open article
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" /> Play now
            </>
          )}
        </DropdownMenuItem>
        {item.kind !== "blog" && (
          <>
            <DropdownMenuItem
              disabled={!item.audio_url}
              onSelect={() => {
                const t = toTrack();
                if (t) playNext(t);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Play next
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!item.audio_url}
              onSelect={() => {
                const t = toTrack();
                if (t) enqueue(t);
              }}
            >
              <ListPlus className="mr-2 h-4 w-4" /> Add to queue
            </DropdownMenuItem>
            {item.link && (
              <DropdownMenuItem
                onSelect={() => window.open(item.link!, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="mr-2 h-4 w-4" /> Open source
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
