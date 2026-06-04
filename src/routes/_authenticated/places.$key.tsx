import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Users, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPlace } from "@/lib/places.functions";

export const Route = createFileRoute("/_authenticated/places/$key")({
  component: PlaceDetail,
  head: ({ params }) => ({
    meta: [
      { title: `Place — Mental Health Walk Club` },
      { name: "description", content: `Standing walks at ${params.key}.` },
    ],
  }),
});

type State = Awaited<ReturnType<typeof getPlace>> | null;

function PlaceDetail() {
  const { key } = Route.useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPlace({ data: { key } })
      .then((r) => setState(r))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load."))
      .finally(() => setLoading(false));
  }, [key]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <div className="h-40 animate-pulse rounded-3xl bg-card" />
      </div>
    );
  }
  if (!state || state.place.group_count === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-6 text-center">
        <p className="font-serif text-lg">No groups here yet</p>
        <Button onClick={() => navigate({ to: "/places" })} className="mt-4 rounded-full">Back to Places</Button>
      </div>
    );
  }

  const { place, upcoming } = state;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <Link to="/places" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Places
      </Link>
      <header className="mb-4">
        <h1 className="font-serif text-2xl text-foreground">{place.label ?? place.neighborhood ?? "Meetup spot"}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {place.neighborhood && place.label && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {place.neighborhood}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            {place.group_count} group{place.group_count === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      <section className="mb-5">
        <h2 className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Groups meeting here</h2>
        <ul className="space-y-2">
          {place.groups.map((g) => (
            <li key={g.id}>
              <Link
                to="/groups/$slug"
                params={{ slug: g.slug }}
                className="block rounded-2xl border border-border bg-card p-3 shadow-soft transition hover:bg-accent/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{g.name}</div>
                    {g.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{g.description}</p>
                    )}
                    <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      {g.next_summary}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Upcoming walks</h2>
          <ul className="space-y-2">
            {upcoming.map((e) => (
              <li key={e.id}>
                <Link
                  to="/events/$slug"
                  params={{ slug: e.slug }}
                  className="block rounded-2xl border border-border bg-card p-3 text-sm shadow-soft transition hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium">{e.title}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(e.starts_at).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
