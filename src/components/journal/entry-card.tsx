import { Footprints, Share2, Camera, PenLine, Mic } from "lucide-react";
import { WeatherPill } from "@/components/weather-pill";

export interface EntryCardWalk {
  id: string;
  started_at: string;
  duration_seconds: number | null;
  distance_meters: number | null;
  steps: number | null;
  mood_before: string | null;
  mood_after: string | null;
  mood_before_score: number | null;
  mood_after_score: number | null;
  reflection_note: string | null;
  walk_type: string;
  intention: string | null;
  weather_at_end: { tempF?: number; label?: string; tone?: string; isDay?: boolean } | null;
}

interface Props {
  walk: EntryCardWalk;
  snapshotUrl?: string;
  photoCount?: number;
  /** Up to 3 signed URLs for the walk's photos, oldest-first. */
  photoUrls?: string[];
  contextLine?: string | null;
  active?: boolean;
  onSelect: () => void;
  onShare: () => void;
}

/**
 * The hero entry primitive for the Journal feed.
 * Walk = entry. Map snapshot is the art; stats/reflection are the caption.
 * When photos exist, the header splits into a map + Apple-Journal-style photo grid.
 * Empty fields simply don't render — quiet walks become quiet cards.
 */
export function EntryCard({ walk, snapshotUrl, photoCount = 0, photoUrls = [], active, onSelect, onShare }: Props) {
  const w = walk;
  const mins = Math.round((w.duration_seconds ?? 0) / 60);
  const miles = ((w.distance_meters ?? 0) * 0.000621371).toFixed(2);
  const steps = (w.steps ?? 0).toLocaleString();
  const date = new Date(w.started_at);
  const dateLabel = date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const timeLabel = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const delta = w.mood_before_score != null && w.mood_after_score != null ? w.mood_after_score - w.mood_before_score : null;

  const hasPhotos = photoCount > 0 && photoUrls.length > 0;
  const hasNote = !!w.reflection_note?.trim();
  const hasAudio = w.walk_type === "audio_room" || w.walk_type === "walk_talk";

  return (
    <article className={`group relative overflow-hidden rounded-3xl border transition active:scale-[0.995] ${active ? "border-forest shadow-elevated" : "border-border bg-card shadow-soft hover:border-forest/30"}`}>
      <button
        type="button"
        onClick={onSelect}
        className="block w-full text-left"
        aria-label={`Open walk from ${dateLabel}`}
      >
        {/* Header — 16:10. Splits into map + photo grid when photos exist. */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-secondary/40">
          {hasPhotos ? (
            <div className="grid h-full w-full grid-cols-5 gap-0.5">
              {/* Left: map (3/5) */}
              <div className="relative col-span-3 overflow-hidden bg-secondary/40">
                {snapshotUrl ? (
                  <img
                    src={snapshotUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                    style={{ filter: "saturate(0.55) contrast(1.02)" }}
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-muted-foreground/50">
                    <Footprints className="h-7 w-7" />
                  </div>
                )}
              </div>
              {/* Right: photo gallery (2/5) — 1, 2, or 3+ tile layout */}
              <div className="col-span-2 grid gap-0.5" style={photoLayoutStyle(photoUrls.length)}>
                {photoUrls.slice(0, 3).map((url, i) => (
                  <div key={i} className="relative overflow-hidden bg-foreground/5">
                    <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    {i === 2 && photoCount > 3 && (
                      <div className="absolute inset-0 grid place-items-center bg-foreground/45 font-serif text-lg text-cream">
                        +{photoCount - 3}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : snapshotUrl ? (
            <img
              src={snapshotUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
              style={{ filter: "saturate(0.55) contrast(1.02)" }}
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground/50">
              <Footprints className="h-8 w-8" />
            </div>
          )}

          {/* Duotone overlay for legibility (covers full header) */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/55 via-foreground/10 to-transparent" />
          {/* Top meta */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 text-cream/95">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">
              {dateLabel} · {timeLabel}
            </div>
            {w.weather_at_end?.tempF != null && (
              <div className="pointer-events-auto shrink-0">
                <WeatherPill tempF={w.weather_at_end.tempF} label={w.weather_at_end.label} tone={(w.weather_at_end.tone as never) || "cloud"} isDay={w.weather_at_end.isDay} />
              </div>
            )}
          </div>
          {/* Stat trio overlaid on bottom */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-baseline justify-between gap-3 p-4 text-cream">
            <Stat value={`${mins}`} unit="min" />
            <Divider />
            <Stat value={miles} unit="mi" />
            <Divider />
            <Stat value={steps} unit="steps" />
          </div>
        </div>

        {/* Caption */}
        <div className="space-y-2 px-4 pb-4 pt-3">
          {/* Media pills — describe what's inside the entry */}
          {(hasPhotos || hasNote || hasAudio) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {hasPhotos && (
                <MediaPill icon={<Camera className="h-3 w-3" />} label={`${photoCount} ${photoCount === 1 ? "photo" : "photos"}`} />
              )}
              {hasNote && <MediaPill icon={<PenLine className="h-3 w-3" />} label="Note" />}
              {hasAudio && <MediaPill icon={<Mic className="h-3 w-3" />} label="Audio" />}
            </div>
          )}
          {(w.mood_before || w.mood_after) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {w.mood_before && <span className="rounded-full bg-secondary px-2 py-0.5 capitalize">{w.mood_before}</span>}
              <span className="text-muted-foreground">→</span>
              {w.mood_after ? (
                <span className="rounded-full bg-accent px-2 py-0.5 capitalize text-accent-foreground">{w.mood_after}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
              {delta !== null && delta !== 0 && (
                <span className={`tabular-nums ${delta > 0 ? "text-forest" : "text-clay"}`}>
                  {delta > 0 ? `+${delta}` : delta}
                </span>
              )}
            </div>
          )}
          {w.reflection_note && (
            <p className="line-clamp-2 font-serif italic leading-snug text-foreground/85">
              "{w.reflection_note}"
            </p>
          )}
        </div>
      </button>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onShare(); }}
        aria-label="Share walk"
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-background/85 text-foreground/80 shadow-soft backdrop-blur transition hover:text-forest"
      >
        <Share2 className="h-3.5 w-3.5" />
      </button>
    </article>
  );
}

function photoLayoutStyle(n: number): React.CSSProperties {
  if (n <= 1) return { gridTemplateRows: "1fr" };
  if (n === 2) return { gridTemplateRows: "1fr 1fr" };
  // 3+ — first photo big, two smaller stacked
  return { gridTemplateRows: "1fr 1fr", gridTemplateColumns: "1fr" };
}

function MediaPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground/75">
      {icon}
      {label}
    </span>
  );
}

function Stat({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="flex items-baseline gap-1 [text-shadow:0_1px_3px_rgba(0,0,0,0.55)]">
      <span className="font-serif text-2xl tabular-nums leading-none">{value}</span>
      <span className="text-[10px] uppercase tracking-wider opacity-80">{unit}</span>
    </div>
  );
}

function Divider() {
  return <span className="h-3 w-px shrink-0 bg-cream/40" aria-hidden />;
}
