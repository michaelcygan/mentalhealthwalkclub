import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronLeft, Play, Radio as RadioIcon, Music, Link as LinkIcon, Podcast, Shuffle, ListOrdered, Repeat } from "lucide-react";
import { getStation, type StationCard, type RadioItem } from "@/lib/radio.functions";
import { startStation } from "@/lib/radio-client";
import { usePlayer } from "@/lib/player-context";
import radioCoverDefault from "@/assets/radio-cover-default.jpg";

export const Route = createFileRoute("/radio/$slug")({
  component: PublicStationPage,
  head: ({ params }) => ({
    meta: [
      { title: `Radio — ${params.slug} · Mental Health Walk Club` },
      { name: "description", content: "A quiet radio station for your walk. Ambient music, gentle podcasts, and community-picked audio." },
      { property: "og:title", content: "Mental Health Walk Club Radio" },
      { property: "og:description", content: "A quiet radio station for your walk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function PublicStationPage() {
  const { slug } = Route.useParams();
  useRouter();
  const fetcher = useServerFn(getStation);
  const player = usePlayer();
  const [state, setState] = useState<{ station: StationCard; items: RadioItem[] } | null | undefined>(undefined);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    fetcher({ data: { slug } })
      .then((r) => setState(r as { station: StationCard; items: RadioItem[] } | null))
      .catch(() => setState(null));
  }, [fetcher, slug]);

  const play = async () => {
    if (!state) return;
    setStarting(true);
    try {
      const ok = await startStation(state.station.slug, player);
      if (!ok) toast.error("Nothing on this station yet.");
      else toast.success(`Playing ${state.station.title}`);
    } catch { toast.error("Couldn't start station."); }
    finally { setStarting(false); }
  };

  if (state === undefined) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!state) return (
    <div className="p-6">
      <p className="font-serif text-sm">Station not found.</p>
      <Link to="/" className="mt-3 inline-block text-xs text-muted-foreground underline">Back home</Link>
    </div>
  );

  const { station, items } = state;
  const cover = station.cover_signed ?? radioCoverDefault;
  const active = items.filter((i) => i.is_active);
  const mix = computeMix(active);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3.5 w-3.5" /> Home
      </Link>

      <header className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
          <img src={cover} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-white/80">
                <RadioIcon className="h-3.5 w-3.5" /> Radio
              </p>
              <h1 className="mt-1 truncate font-serif text-2xl text-white sm:text-3xl">{station.title}</h1>
              {station.subtitle && <p className="mt-1 line-clamp-2 text-sm text-white/85">{station.subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={play}
              disabled={starting || !active.length}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-forest shadow-md transition active:scale-[0.98] disabled:opacity-60"
            >
              <Play className="h-4 w-4" /> {starting ? "Starting…" : "Play"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-5 py-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
            {station.playback_mode === "shuffle" ? <Shuffle className="h-3 w-3" /> : <ListOrdered className="h-3 w-3" />}
            {station.playback_mode === "shuffle" ? "Shuffle" : "In order"}
          </span>
          {station.loop_enabled && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
              <Repeat className="h-3 w-3" /> Loops
            </span>
          )}
          {mix.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">{mix.join(" · ")}</span>
          )}
          <span className="ml-auto">{active.length} item{active.length === 1 ? "" : "s"}</span>
        </div>
      </header>

      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing on this station yet.</p>
      ) : (
        <ul className="space-y-2">
          {active.map((t, i) => (
            <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <span className="w-6 shrink-0 text-center text-[11px] text-muted-foreground">{i + 1}</span>
              <SourceBadge kind={t.source_type} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.title}</p>
                {t.artist && <p className="truncate text-[11px] text-muted-foreground">{t.artist}</p>}
              </div>
              {t.duration_s != null && (
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {Math.round(t.duration_s / 60)}m
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function computeMix(items: RadioItem[]): string[] {
  const counts = { upload: 0, external_url: 0, podcast_episode: 0 } as Record<RadioItem["source_type"], number>;
  for (const it of items) counts[it.source_type] = (counts[it.source_type] ?? 0) + 1;
  const labels: string[] = [];
  if (counts.upload) labels.push("Uploads");
  if (counts.external_url) labels.push("Links");
  if (counts.podcast_episode) labels.push("Podcast");
  return labels;
}

function SourceBadge({ kind }: { kind: RadioItem["source_type"] }) {
  const map = {
    upload: { icon: Music, cls: "bg-forest/10 text-forest" },
    external_url: { icon: LinkIcon, cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    podcast_episode: { icon: Podcast, cls: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
  } as const;
  const { icon: Icon, cls } = map[kind];
  return (
    <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}
