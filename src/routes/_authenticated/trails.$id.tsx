import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Bookmark, BookmarkCheck, MapPin, Footprints, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTrail, saveTrail, unsaveTrail } from "@/lib/trails.functions";
import WalkMap from "@/components/walk-page/walk-map";

export const Route = createFileRoute("/_authenticated/trails/$id")({
  component: TrailDetail,
  head: ({ params }) => ({
    meta: [
      { title: `Trail — Mental Health Walk Club` },
      { name: "description", content: `Trail ${params.id}` },
    ],
  }),
});

type State = Awaited<ReturnType<typeof getTrail>> | null;

function TrailDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    getTrail({ data: { id } })
      .then((r) => setState(r))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load."))
      .finally(() => setLoading(false));
  }, [id]);

  async function toggleSave() {
    if (!state) return;
    setBusy(true);
    try {
      if (state.saved) {
        await unsaveTrail({ data: { trail_id: state.trail.id } });
        setState({ ...state, saved: false });
      } else {
        await saveTrail({ data: { trail_id: state.trail.id } });
        setState({ ...state, saved: true });
        toast.success("Saved");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function startWalkHere() {
    if (!state) return;
    const t = state.trail;
    try {
      sessionStorage.setItem(
        "walk_create_intent",
        JSON.stringify({
          trail_id: t.id,
          lat: t.lat,
          lng: t.lng,
          label: t.name ?? "Trailhead",
        }),
      );
    } catch { /* ignore */ }
    navigate({ to: "/" });
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <div className="h-72 animate-pulse rounded-3xl bg-card" />
      </div>
    );
  }
  if (!state) return null;

  const { trail, saved, cover_image_url } = state;
  const tags = (trail.tags ?? {}) as Record<string, string>;
  const surface = tags.surface;
  const access = tags.access;
  const wheelchair = tags.wheelchair;
  const osmHref = trail.osm_id
    ? `https://www.openstreetmap.org/${trail.osm_id}`
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <Link to="/trails" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to Trails
      </Link>

      {cover_image_url && (
        <div className="mb-4 overflow-hidden rounded-3xl border border-border shadow-soft">
          <img src={cover_image_url} alt={trail.name ?? "Trail"} className="h-56 w-full object-cover" />
        </div>
      )}

      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl">{trail.name ?? "Unnamed trail"}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-forest/10 px-1.5 py-0.5 text-forest">{trail.kind ?? "trail"}</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {trail.lat.toFixed(3)}, {trail.lng.toFixed(3)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleSave}
          disabled={busy}
          className="shrink-0 rounded-full border border-border p-2 text-muted-foreground hover:bg-accent/40 hover:text-foreground disabled:opacity-50"
          aria-label={saved ? "Remove from saved" : "Save trail"}
        >
          {saved ? <BookmarkCheck className="h-5 w-5 text-forest" /> : <Bookmark className="h-5 w-5" />}
        </button>
      </header>

      <div className="mb-4">
        <WalkMap lat={trail.lat} lng={trail.lng} title={trail.name ?? "Trail"} venue={tags["addr:street"] ?? null} />
      </div>

      {(surface || access || wheelchair || tags.lit) && (
        <section className="mb-5 rounded-3xl border border-border bg-card p-4 shadow-soft">
          <h2 className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Details</h2>
          <ul className="grid grid-cols-2 gap-2 text-xs">
            {surface && <li><span className="text-muted-foreground">Surface:</span> {surface}</li>}
            {access && <li><span className="text-muted-foreground">Access:</span> {access}</li>}
            {wheelchair && <li><span className="text-muted-foreground">Wheelchair:</span> {wheelchair}</li>}
            {tags.lit && <li><span className="text-muted-foreground">Lit:</span> {tags.lit}</li>}
          </ul>
        </section>
      )}

      <div className="space-y-2">
        <Button onClick={startWalkHere} className="w-full rounded-full" size="lg">
          <Footprints className="mr-2 h-4 w-4" /> Start a walk here
        </Button>
        {osmHref && (
          <a
            href={osmHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            View on OpenStreetMap <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}
