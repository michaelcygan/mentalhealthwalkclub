import { Link } from "@tanstack/react-router";
import { Play, Plus, Sparkles } from "lucide-react";

type Pod = { id: string; title: string; image_url: string | null; duration_seconds: number | null; is_featured?: boolean | null };
type Amb = { id: string; title: string; artist: string | null; duration_seconds: number | null; mood_tags?: string[] | null; is_featured?: boolean | null };
type Guided = { id: string; title: string; host: string | null; cover_url: string | null; duration_seconds: number | null; is_featured?: boolean | null };

type Pick = {
  kind: "podcast" | "ambient" | "guided";
  title: string;
  sub: string;
  cover: string | null;
  badge: string;
};

function fmtMins(s: number | null | undefined) {
  if (!s) return "";
  return `${Math.round(s / 60)} min`;
}

function pickByTime(opts: { pods: Pod[]; ambient: Amb[]; guided: Guided[] }): Pick | null {
  const hour = new Date().getHours();
  const featured = [
    ...opts.guided.filter((g) => g.is_featured).map((g) => ({ k: "guided" as const, v: g })),
    ...opts.pods.filter((p) => p.is_featured).map((p) => ({ k: "podcast" as const, v: p })),
    ...opts.ambient.filter((a) => a.is_featured).map((a) => ({ k: "ambient" as const, v: a })),
  ];
  const featuredPick = featured[0];
  if (featuredPick) {
    if (featuredPick.k === "guided") {
      const g = featuredPick.v;
      return { kind: "guided", title: g.title, sub: `Guided walk · ${fmtMins(g.duration_seconds)}`, cover: g.cover_url, badge: "Editor's pick" };
    }
    if (featuredPick.k === "podcast") {
      const p = featuredPick.v;
      return { kind: "podcast", title: p.title, sub: `Podcast · ${fmtMins(p.duration_seconds)}`, cover: p.image_url, badge: "Editor's pick" };
    }
    const a = featuredPick.v;
    return { kind: "ambient", title: a.title, sub: `Ambient · ${fmtMins(a.duration_seconds)}`, cover: null, badge: "Editor's pick" };
  }
  // Morning → guided / calm
  if (hour < 11 && opts.guided.length) {
    const g = opts.guided[0];
    return { kind: "guided", title: g.title, sub: `Guided walk · ${fmtMins(g.duration_seconds)}`, cover: g.cover_url, badge: "Slow start" };
  }
  // Afternoon → podcast
  if (hour < 17 && opts.pods.length) {
    const p = opts.pods[0];
    return { kind: "podcast", title: p.title, sub: `Podcast · ${fmtMins(p.duration_seconds)}`, cover: p.image_url, badge: "Walk-worthy" };
  }
  // Evening → ambient
  if (opts.ambient.length) {
    const a = opts.ambient[0];
    return { kind: "ambient", title: a.title, sub: `Ambient · ${fmtMins(a.duration_seconds)}`, cover: null, badge: "Wind down" };
  }
  if (opts.pods.length) {
    const p = opts.pods[0];
    return { kind: "podcast", title: p.title, sub: `Podcast · ${fmtMins(p.duration_seconds)}`, cover: p.image_url, badge: "For your next walk" };
  }
  return null;
}

export function TodayPick({ pods, ambient, guided }: { pods: Pod[]; ambient: Amb[]; guided: Guided[] }) {
  const pick = pickByTime({ pods, ambient, guided });
  if (!pick) return null;
  return (
    <section className="mb-6 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-forest/10 via-card to-card p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-forest/15">
          {pick.cover ? <img src={pick.cover} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-forest/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-forest">
            <Sparkles className="h-3 w-3" /> {pick.badge}
          </div>
          <p className="truncate font-serif text-base leading-tight">{pick.title}</p>
          <p className="truncate text-[11px] text-muted-foreground">{pick.sub}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
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
