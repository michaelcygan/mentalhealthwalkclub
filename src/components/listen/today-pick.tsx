import { Link } from "@tanstack/react-router";
import { Play, Plus, Sparkles } from "lucide-react";
import { CoverThumb } from "@/components/listen/cover-thumb";
import { usePlayOrOpen, type PlayableItem } from "@/lib/play-helpers";

type Pod = { id: string; title: string; image_url: string | null; duration_seconds: number | null; audio_url?: string | null; episode_url?: string | null; is_featured?: boolean | null };
type Amb = { id: string; title: string; artist: string | null; cover_path?: string | null; duration_seconds: number | null; mood_tags?: string[] | null; is_featured?: boolean | null };
type Guided = { id: string; title: string; host: string | null; cover_url: string | null; duration_seconds: number | null; audio_url?: string | null; is_featured?: boolean | null };

type Pick = {
  item: PlayableItem;
  badge: string;
  sub: string;
};

function fmtMins(s: number | null | undefined) {
  if (!s) return "";
  return `${Math.round(s / 60)} min`;
}

function pickByTime(opts: { pods: Pod[]; ambient: Amb[]; guided: Guided[] }): Pick | null {
  const hour = new Date().getHours();
  const toGuided = (g: Guided, badge: string): Pick => ({
    badge, sub: `Guided walk · ${fmtMins(g.duration_seconds)}`,
    item: { kind: "guided", id: g.id, title: g.title, subtitle: g.host, cover: g.cover_url, audio_url: g.audio_url ?? null, duration_seconds: g.duration_seconds },
  });
  const toPod = (p: Pod, badge: string): Pick => ({
    badge, sub: `Podcast · ${fmtMins(p.duration_seconds)}`,
    item: { kind: "podcast", id: p.id, title: p.title, cover: p.image_url, audio_url: p.audio_url ?? null, link: p.episode_url ?? null, duration_seconds: p.duration_seconds },
  });
  const toAmb = (a: Amb, badge: string): Pick => ({
    badge, sub: `Ambient · ${fmtMins(a.duration_seconds)}`,
    item: { kind: "ambient", id: a.id, title: a.title, subtitle: a.artist, cover: a.cover_path ?? null },
  });

  const featured =
    opts.guided.find((g) => g.is_featured) ? toGuided(opts.guided.find((g) => g.is_featured)!, "Editor's pick") :
    opts.pods.find((p) => p.is_featured) ? toPod(opts.pods.find((p) => p.is_featured)!, "Editor's pick") :
    opts.ambient.find((a) => a.is_featured) ? toAmb(opts.ambient.find((a) => a.is_featured)!, "Editor's pick") : null;
  if (featured) return featured;

  if (hour < 11 && opts.guided.length) return toGuided(opts.guided[0], "Slow start");
  if (hour < 17 && opts.pods.length) return toPod(opts.pods[0], "Walk-worthy");
  if (opts.ambient.length) return toAmb(opts.ambient[0], "Wind down");
  if (opts.pods.length) return toPod(opts.pods[0], "For your next walk");
  return null;
}

export function TodayPick({ pods, ambient, guided }: { pods: Pod[]; ambient: Amb[]; guided: Guided[] }) {
  const playOrOpen = usePlayOrOpen();
  const pick = pickByTime({ pods, ambient, guided });
  if (!pick) return null;
  return (
    <section className="mb-6 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-forest/10 via-card to-card p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl">
          <CoverThumb src={pick.item.cover ?? null} title={pick.item.title} kind={pick.item.kind} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-forest/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-forest">
            <Sparkles className="h-3 w-3" /> {pick.badge}
          </div>
          <p className="truncate font-serif text-base leading-tight">{pick.item.title}</p>
          <p className="truncate text-[11px] text-muted-foreground">{pick.sub}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => playOrOpen(pick.item)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-forest px-3 py-2 text-sm text-primary-foreground"
        >
          <Play className="h-3.5 w-3.5" /> Play
        </button>
        <Link
          to="/walk/new"
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-sm"
        >
          <Plus className="h-3.5 w-3.5" /> Add to walk
        </Link>
      </div>
    </section>
  );
}
