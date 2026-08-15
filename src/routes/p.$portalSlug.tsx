import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { PublicWalkBoard } from "@/components/public/walk-board";
import { getPortalBySlug, publicWalkBoard } from "@/lib/public-utility.functions";
import type { PublicArea } from "@/lib/public-area";

/**
 * NFC / signage portal. A visitor taps a tag in a park and lands here with
 * the area already resolved — no location permission, no account.
 */
export const Route = createFileRoute("/p/$portalSlug")({
  loader: async ({ params }) => {
    const { portal } = await getPortalBySlug({ data: { slug: params.portalSlug } });
    if (!portal) throw notFound();
    const board = await publicWalkBoard({
      data: {
        lat: portal.lat,
        lng: portal.lng,
        city: portal.city,
        radiusMiles: portal.radius_miles,
        horizonHours: 720,
        limit: 24,
      },
    });
    return { portal, walks: board.walks };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Unavailable — Mental Health Walk Club" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = `Walks around ${loaderData.portal.label} — Mental Health Walk Club`;
    const desc = `Upcoming community walks within ${loaderData.portal.radius_miles} miles of ${loaderData.portal.label}.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
      ],
    };
  },
  component: PortalRoute,
  notFoundComponent: PortalNotFound,
  errorComponent: PortalNotFound,
});

function PortalRoute() {
  const { portal, walks } = Route.useLoaderData();
  const area: PublicArea = {
    label: portal.label,
    city: portal.city,
    lat: portal.lat,
    lng: portal.lng,
    radiusMiles: portal.radius_miles,
    source: "portal",
  };

  return (
    <div className="space-y-5 py-6">
      <p className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-[11px] text-muted-foreground shadow-soft">
        You're at {portal.label}
      </p>
      <PublicWalkBoard
        initialWalks={walks}
        forcedArea={area}
        heading={`Walks around ${portal.label}`}
        subheading="Tap a walk to see the meeting point and time. Nothing to install."
        allowAreaChange={false}
      />
    </div>
  );
}

function PortalNotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <h1 className="font-serif text-xl">This spot isn't set up</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The tag you tapped isn't active. You can still browse walks near you.
      </p>
      <Link
        to="/walks"
        className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-forest px-5 text-sm font-medium text-primary-foreground"
      >
        Browse walks
      </Link>
    </div>
  );
}
