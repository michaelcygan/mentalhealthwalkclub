import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getWalkRecap } from "@/lib/walk-page.functions";
import { Share2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/w/$code/recap")({
  loader: async ({ params }) => {
    const data = await getWalkRecap({ data: { code: params.code } });
    if (!data.event) throw notFound();
    return data;
  },
  head: ({ params }) => ({
    meta: [
      { title: `Recap · ${params.code} · Mental Health Walk Club` },
      { name: "description", content: "We walked. Here's the recap." },
      { property: "og:image", content: `/api/public/walk/${params.code}/og` },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-md p-10 text-center">
      <h1 className="font-serif text-2xl">Couldn't load recap</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-md p-10 text-center">
      <h1 className="font-serif text-2xl">Recap not found</h1>
      <Link to="/" className="mt-4 inline-flex rounded-full bg-forest px-5 py-2 text-sm text-primary-foreground">
        Back to the club
      </Link>
    </div>
  ),
  component: RecapPage,
});

function RecapPage() {
  const { code } = Route.useParams();
  const { event, attendees, guests, host } = Route.useLoaderData();
  if (!event) return null;

  const total = attendees.length + guests;
  const minutes =
    event.ends_at && event.starts_at
      ? Math.max(0, Math.round((new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime()) / 60000))
      : null;
  const miles = event.distance_meters ? (event.distance_meters / 1609.34).toFixed(1) : null;

  const share = async () => {
    const url = `${window.location.origin}/w/${code}/recap`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Recap · ${event.title}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Recap link copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 pb-24 pt-6">
      <Link to="/w/$code" params={{ code }} className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
        ← Back to walk
      </Link>

      <div className="mt-4 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-cream via-clay/20 to-forest/20 p-6 shadow-soft">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Recap</div>
        <h1 className="mt-2 font-serif text-3xl leading-tight">{event.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date(event.starts_at).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
          {event.city ? ` · ${event.city}` : ""}
        </p>

        {event.image_url ? (
          <img src={event.image_url} alt="" className="mt-5 h-44 w-full rounded-2xl object-cover sm:h-56" loading="lazy" />
        ) : null}

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="walked together" value={String(total)} />
          {minutes != null ? <Stat label="minutes" value={String(minutes)} /> : <Stat label="vibe" value={event.vibe ?? "quiet"} />}
          {miles ? <Stat label="miles" value={miles} /> : <Stat label="hosted by" value={host?.display_name ?? "—"} />}
        </div>

        {attendees.length > 0 ? (
          <div className="mt-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Walkers</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {attendees.slice(0, 24).map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-2.5 py-1 text-xs">
                  {a.avatar_url ? (
                    <img src={a.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-forest/20 text-[10px] text-forest">
                      {(a.display_name ?? "?").slice(0, 1)}
                    </span>
                  )}
                  {a.display_name ?? "Walker"}
                </div>
              ))}
              {guests > 0 ? (
                <span className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground">
                  +{guests} guest{guests === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <button
          onClick={share}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm text-primary-foreground hover:opacity-90"
        >
          <Share2 className="h-4 w-4" /> Share recap
        </button>
      </div>

      <Link
        to="/walk/new"
        className="mt-6 block rounded-3xl border border-dashed border-border bg-card/40 p-5 text-center text-sm hover:bg-card/70"
      >
        Plan the next walk →
      </Link>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card/70 p-3 text-center">
      <div className="font-serif text-2xl text-foreground">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
