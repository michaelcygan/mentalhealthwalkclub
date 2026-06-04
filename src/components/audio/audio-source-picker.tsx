/**
 * Pre-walk audio source picker (silence / ambient / podcast / playlist).
 *
 * Phase 7 (solo walks slim) will mount this on the pre-walk screen. The
 * caller passes the user's playlists and receives the picked source as a
 * structured value that maps directly to the walk_sessions audio columns.
 */
import { useState } from "react";
import { CheckCircle2, Volume2, VolumeX, Mic2, ListMusic } from "lucide-react";

export type AudioSource =
  | { kind: "silence" }
  | { kind: "ambient" }
  | { kind: "podcast_episode"; track_id: string; title: string }
  | { kind: "playlist"; playlist_id: string; name: string };

type Props = {
  value: AudioSource;
  onChange: (s: AudioSource) => void;
  playlists?: { id: string; name: string }[];
  podcasts?: { id: string; title: string }[];
};

export function AudioSourcePicker({ value, onChange, playlists = [], podcasts = [] }: Props) {
  const [expanded, setExpanded] = useState<"podcast" | "playlist" | null>(
    value.kind === "podcast_episode" ? "podcast" : value.kind === "playlist" ? "playlist" : null,
  );

  const Row = ({ active, icon, label, sub, onClick }: { active: boolean; icon: React.ReactNode; label: string; sub?: string; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
        active ? "border-forest bg-forest/5" : "border-border bg-card hover:bg-accent/30"
      }`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{label}</span>
        {sub && <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>}
      </span>
      {active && <CheckCircle2 className="h-4 w-4 text-forest" />}
    </button>
  );

  return (
    <div className="space-y-2">
      <Row
        active={value.kind === "silence"}
        icon={<VolumeX className="h-4 w-4" />}
        label="Silence"
        sub="Just the timer and your thoughts"
        onClick={() => { setExpanded(null); onChange({ kind: "silence" }); }}
      />
      <Row
        active={value.kind === "ambient"}
        icon={<Volume2 className="h-4 w-4" />}
        label="Ambient mix"
        sub="Auto-shuffled background music"
        onClick={() => { setExpanded(null); onChange({ kind: "ambient" }); }}
      />
      <Row
        active={value.kind === "podcast_episode"}
        icon={<Mic2 className="h-4 w-4" />}
        label="Podcast episode"
        sub={value.kind === "podcast_episode" ? value.title : "Pick something walk-friendly"}
        onClick={() => setExpanded(expanded === "podcast" ? null : "podcast")}
      />
      {expanded === "podcast" && (
        <ul className="space-y-1 rounded-2xl border border-border bg-card/60 p-2">
          {podcasts.length === 0 && <li className="px-2 py-1 text-xs text-muted-foreground">No podcasts available.</li>}
          {podcasts.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onChange({ kind: "podcast_episode", track_id: p.id, title: p.title })}
                className={`w-full truncate rounded-xl px-2 py-1.5 text-left text-xs hover:bg-accent/40 ${
                  value.kind === "podcast_episode" && value.track_id === p.id ? "bg-accent/30 font-medium" : ""
                }`}
              >
                {p.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Row
        active={value.kind === "playlist"}
        icon={<ListMusic className="h-4 w-4" />}
        label="Your playlist"
        sub={value.kind === "playlist" ? value.name : "Pick a custom queue"}
        onClick={() => setExpanded(expanded === "playlist" ? null : "playlist")}
      />
      {expanded === "playlist" && (
        <ul className="space-y-1 rounded-2xl border border-border bg-card/60 p-2">
          {playlists.length === 0 && <li className="px-2 py-1 text-xs text-muted-foreground">No playlists yet. Build one in Listen.</li>}
          {playlists.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onChange({ kind: "playlist", playlist_id: p.id, name: p.name })}
                className={`w-full truncate rounded-xl px-2 py-1.5 text-left text-xs hover:bg-accent/40 ${
                  value.kind === "playlist" && value.playlist_id === p.id ? "bg-accent/30 font-medium" : ""
                }`}
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
