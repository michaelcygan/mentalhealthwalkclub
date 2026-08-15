import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PublicWalkBoard } from "@/components/public/walk-board";
import { publicWalkBoard } from "@/lib/public-utility.functions";
import { areaFromSearch } from "@/lib/public-area";

const SITE_URL = "https://mentalhealthwalkclub.com/walks";
const DESC =
  "Browse upcoming community walks near you. See the meeting point and time, then RSVP — no account needed to look.";

const Search = z.object({
  city: z.string().trim().max(120).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export const Route = createFileRoute("/walks")({
  validateSearch: (s) => Search.parse(s),
  loaderDeps: ({ search }) => ({
    city: search.city ?? null,
    lat: search.lat ?? null,
    lng: search.lng ?? null,
  }),
  loader: ({ deps }) =>
    publicWalkBoard({
      data: {
        city: deps.city,
        lat: deps.lat,
        lng: deps.lng,
        radiusMiles: 25,
        horizonHours: 720,
        limit: 24,
      },
    }),
  head: () => ({
    meta: [
      { title: "Community walks near you — Mental Health Walk Club" },
      { name: "description", content: DESC },
      { property: "og:title", content: "Community walks near you" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Community walks near you" },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
  }),
  component: WalksRoute,
  errorComponent: () => (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <h1 className="font-serif text-xl">Walks couldn't load</h1>
      <p className="mt-2 text-sm text-muted-foreground">Refresh the page and we'll try again.</p>
    </div>
  ),
});

function WalksRoute() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const campaign = areaFromSearch(search as Record<string, unknown>);

  return (
    <div className="py-6">
      <PublicWalkBoard
        initialWalks={data.walks}
        forcedArea={campaign}
        heading="Community walks"
        subheading="Real meetups in real places. Look around, then RSVP when one fits."
      />
    </div>
  );
}
